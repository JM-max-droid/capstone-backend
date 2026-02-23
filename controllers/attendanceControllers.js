const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const User = require("../models/User");
const ExcelJS = require("exceljs");

// ============================== 
// ✅ HELPER: Filter students by tab and criteria
// ============================== 
const filterStudentsByTab = (students, tab, yearLevel, family, event) => {
  return students.filter(s => {
    const yl = parseInt(s.yearLevel) || 0;
    const isFamily = s.course?.toLowerCase().includes("family");

    if (tab === "family") {
      if (!isFamily) return false;
      if (event.participationType === "FAMILY" && event.families && event.families.length > 0) {
        const familyNum = s.course?.match(/\d+/)?.[0];
        if (!familyNum || !event.families.includes(parseInt(familyNum))) return false;
      }
      if (family && family !== "all") {
        const familyNum = s.course?.match(/\d+/)?.[0];
        if (familyNum !== family) return false;
      }
      return true;
    }

    if (tab === "seniorHigh") {
      if (isFamily) return false;
      const inRange = yl >= 11 && yl <= 12;
      if (!inRange) return false;
      if (yearLevel && yearLevel !== "all" && String(yl) !== yearLevel) return false;
      return true;
    }

    if (tab === "college") {
      if (isFamily) return false;
      const inRange = yl >= 1 && yl <= 4;
      if (!inRange) return false;
      if (yearLevel && yearLevel !== "all" && String(yl) !== yearLevel) return false;
      return true;
    }

    return true;
  });
};

// ============================== 
// ✅ Parse time string - handles "8:03 AM" format reliably
// ============================== 
const parseTime = (timeStr) => {
  try {
    if (!timeStr || typeof timeStr !== 'string') {
      console.log("⚠️ Invalid time input:", timeStr);
      return null;
    }

    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      console.log("⚠️ Invalid time format:", timeStr);
      return null;
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.log("⚠️ Time out of range:", { timeStr, hours, minutes });
      return null;
    }

    console.log(`✅ Parsed time: ${timeStr} -> ${hours}:${String(minutes).padStart(2,'0')}`);
    return { hours, minutes };
  } catch (err) {
    console.error("❌ Error parsing time:", timeStr, err);
    return null;
  }
};

// ============================== 
// ✅ Get PHT (UTC+8) current minutes
// ============================== 
const getPHTMinutes = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const hours = pht.getUTCHours();
  const minutes = pht.getUTCMinutes();
  console.log(`🇵🇭 PHT: ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')} | UTC: ${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`);
  return hours * 60 + minutes;
};

// ============================== 
// ✅ Get PHT date string (YYYY-MM-DD)
// ============================== 
const getPHTDateString = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = pht.getUTCFullYear();
  const month = String(pht.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pht.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================== 
// ✅ Get PHT time string for storing in DB
// ============================== 
const getPHTTimeString = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  let hours = pht.getUTCHours();
  const minutes = pht.getUTCMinutes();
  const seconds = pht.getUTCSeconds();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')} ${period}`;
};

// ============================== 
// ✅ NEW: Check if all attendance windows for an event have fully ended.
// A window is "ended" when:
//   - Time-in:  current time > end + allottedTime
//   - Time-out: current time > timeout + 60 min
// Returns true if every single window has closed.
// ============================== 
const areAllWindowsClosed = (event) => {
  const currentMinutes = getPHTMinutes();
  let latestWindowEnd = -1;

  if (event.morningAttendance?.end) {
    const end = parseTime(event.morningAttendance.end);
    const allotted = event.morningAttendance?.allottedTime || 30;
    if (end) latestWindowEnd = Math.max(latestWindowEnd, (end.hours * 60 + end.minutes) + allotted);
  }
  if (event.morningAttendance?.timeout) {
    const t = parseTime(event.morningAttendance.timeout);
    if (t) latestWindowEnd = Math.max(latestWindowEnd, (t.hours * 60 + t.minutes) + 60);
  }
  if (event.afternoonAttendance?.end) {
    const end = parseTime(event.afternoonAttendance.end);
    const allotted = event.afternoonAttendance?.allottedTime || 30;
    if (end) latestWindowEnd = Math.max(latestWindowEnd, (end.hours * 60 + end.minutes) + allotted);
  }
  if (event.afternoonAttendance?.timeout) {
    const t = parseTime(event.afternoonAttendance.timeout);
    if (t) latestWindowEnd = Math.max(latestWindowEnd, (t.hours * 60 + t.minutes) + 60);
  }

  if (latestWindowEnd === -1) return false;
  return currentMinutes > latestWindowEnd;
};

// ============================== 
// ✅ Get session info with EARLY ATTENDANCE support
// ============================== 
const getSessionInfo = (event) => {
  try {
    const currentMinutes = getPHTMinutes();
    console.log(`🕐 Current PHT minutes: ${currentMinutes}`);

    const sessions = [];

    // ── MORNING TIME-IN ──────────────────────────────────────────────────────
    if (event.morningAttendance?.start && event.morningAttendance?.end) {
      const start = parseTime(event.morningAttendance.start);
      const end   = parseTime(event.morningAttendance.end);

      if (start && end) {
        const startMin  = start.hours * 60 + start.minutes;
        const endMin    = end.hours * 60 + end.minutes;
        const allotted  = event.morningAttendance.allottedTime || 30;
        const lateLimit = endMin + allotted;

        if (currentMinutes >= 0 && currentMinutes <= lateLimit) {
          let status = "present";
          if (currentMinutes > endMin) status = "late";

          console.log(`✅ MORNING TIME-IN ACTIVE (${status})`);
          sessions.push({
            session:  "morning",
            type:     "in",
            status,
            isLate:   status === "late",
            isEarly:  currentMinutes < startMin,
            start:    event.morningAttendance.start,
            end:      event.morningAttendance.end,
            allotted,
          });
        }
      }
    }

    // ── MORNING TIME-OUT ─────────────────────────────────────────────────────
    if (event.morningAttendance?.timeout) {
      console.log(`🔍 Checking morning timeout: ${event.morningAttendance.timeout}`);
      const timeout = parseTime(event.morningAttendance.timeout);

      if (timeout) {
        const timeoutMin = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd = timeoutMin + 60;

        const isEarlyOut  = currentMinutes >= 0 && currentMinutes < timeoutMin;
        const isNormalOut = currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd;

        if (isEarlyOut || isNormalOut) {
          console.log(`✅ MORNING TIME-OUT ACTIVE (${isEarlyOut ? "early" : "normal"})`);
          sessions.push({
            session:    "morning",
            type:       "out",
            status:     "present",
            isLate:     false,
            isEarlyOut,
            timeout:    event.morningAttendance.timeout,
          });
        }
      }
    }

    // ── AFTERNOON TIME-IN ────────────────────────────────────────────────────
    if (event.afternoonAttendance?.start && event.afternoonAttendance?.end) {
      const start = parseTime(event.afternoonAttendance.start);
      const end   = parseTime(event.afternoonAttendance.end);

      if (start && end) {
        const startMin  = start.hours * 60 + start.minutes;
        let   endMin    = end.hours * 60 + end.minutes;
        if (endMin < startMin) endMin += 24 * 60;

        const allotted  = event.afternoonAttendance.allottedTime || 30;
        const lateLimit = endMin + allotted;

        const noonMin = 12 * 60;
        if (currentMinutes >= noonMin && currentMinutes <= lateLimit) {
          let status = "present";
          if (currentMinutes > endMin) status = "late";

          console.log(`✅ AFTERNOON TIME-IN ACTIVE (${status})`);
          sessions.push({
            session:  "afternoon",
            type:     "in",
            status,
            isLate:   status === "late",
            isEarly:  currentMinutes < startMin,
            start:    event.afternoonAttendance.start,
            end:      event.afternoonAttendance.end,
            allotted,
          });
        }
      }
    }

    // ── AFTERNOON TIME-OUT ───────────────────────────────────────────────────
    if (event.afternoonAttendance?.timeout) {
      console.log(`🔍 Checking afternoon timeout: ${event.afternoonAttendance.timeout}`);
      const timeout = parseTime(event.afternoonAttendance.timeout);

      if (timeout) {
        const timeoutMin = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd = timeoutMin + 60;
        const noonMin    = 12 * 60;

        const isEarlyOut  = currentMinutes >= noonMin && currentMinutes < timeoutMin;
        const isNormalOut = currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd;

        if (isEarlyOut || isNormalOut) {
          console.log(`✅ AFTERNOON TIME-OUT ACTIVE (${isEarlyOut ? "early" : "normal"})`);
          sessions.push({
            session:    "afternoon",
            type:       "out",
            status:     "present",
            isLate:     false,
            isEarlyOut,
            timeout:    event.afternoonAttendance.timeout,
          });
        }
      }
    }

    console.log(`✅ Found ${sessions.length} active sessions:`, sessions.map(s => `${s.session} ${s.type}${s.isEarly ? " (early)" : ""}${s.isEarlyOut ? " (earlyOut)" : ""}`).join(", "));
    return sessions;
  } catch (err) {
    console.error("❌ Error in getSessionInfo:", err);
    return [];
  }
};

// ============================== 
// ✅ CREATE ATTENDANCE
// ============================== 
const createAttendance = async (req, res) => {
  try {
    const { studentId, sscId, eventId, role, actionType, withParents } = req.body;

    console.log("📝 Attendance request:", { studentId, sscId, eventId, role, actionType, withParents });

    if (role !== "ssc") {
      return res.status(403).json({ error: "Access denied. SSC only." });
    }

    if (!studentId || !sscId || !eventId || !actionType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return res.status(400).json({ error: "Invalid student" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const today       = getPHTDateString();
    const currentTime = getPHTTimeString();

    console.log(`⏰ PHT time: ${currentTime}, date: ${today}`);

    // ── ✅ NEW: Check if ALL attendance windows for today have already closed ──
    // This fires before getSessionInfo so we can return a dedicated error code
    // that the frontend can display a specific "attendance closed" alert for.
    if (areAllWindowsClosed(event)) {
      return res.status(410).json({
        error: "ATTENDANCE_CLOSED",
        message: "All attendance windows for today have ended. The time-in and time-out periods, including the allotted grace time, have already passed. No further attendance can be recorded for this event.",
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const sessions = getSessionInfo(event);

    if (sessions.length === 0) {
      return res.status(400).json({
        error: "No active session available at this time."
      });
    }

    let record = await Attendance.findOne({ studentId, eventId, date: today });

    // ── TIME IN ──────────────────────────────────────────────────────────────
    if (actionType === "timein") {
      const timeInSession = sessions.find(s => s.type === "in");

      if (!timeInSession) {
        return res.status(400).json({
          error: "No active time-in window available at this time."
        });
      }

      const { session, status, isEarly } = timeInSession;

      if (!record) {
        record = new Attendance({
          studentId, sscId, eventId, date: today,
          morningStatus:   "absent",
          afternoonStatus: "absent",
        });
      }

      if (session === "morning") {
        if (record.morningIn) {
          return res.status(409).json({
            error: `Already timed in for morning session at ${record.morningIn}. Status: ${record.morningStatus.toUpperCase()}`
          });
        }
        record.morningIn     = currentTime;
        record.morningStatus = status;
        if (isEarly) record.morningNote = "Early arrival";
      } else {
        if (record.afternoonIn) {
          return res.status(409).json({
            error: `Already timed in for afternoon session at ${record.afternoonIn}. Status: ${record.afternoonStatus.toUpperCase()}`
          });
        }
        record.afternoonIn     = currentTime;
        record.afternoonStatus = status;
        if (isEarly) record.afternoonNote = "Early arrival";
      }

      await record.save();

      const earlyMsg = isEarly
        ? ` (early arrival — recorded before the ${session} window opens)`
        : "";

      return res.status(201).json({
        message: `Successfully timed in as ${status.toUpperCase()} for ${session} session${earlyMsg}`,
        record,
      });
    }

    // ── TIME OUT ─────────────────────────────────────────────────────────────
    if (actionType === "timeout") {
      const timeOutSession = sessions.find(s => s.type === "out");

      if (!timeOutSession) {
        return res.status(400).json({
          error: "No active time-out window available at this time."
        });
      }

      const { session, isEarlyOut } = timeOutSession;

      if (!record) {
        return res.status(400).json({
          error: "Cannot time out. No attendance record found. Please time in first."
        });
      }

      if (session === "morning") {
        if (!record.morningIn) {
          return res.status(400).json({
            error: "Cannot time out for morning session. You haven't timed in yet."
          });
        }
        if (record.morningOut) {
          return res.status(409).json({
            error: `Already timed out for morning session at ${record.morningOut}`
          });
        }
        record.morningOut = currentTime;
        if (withParents)  record.morningNote  = (record.morningNote  ? record.morningNote  + " | " : "") + "Left with parents";
        if (isEarlyOut)   record.morningNote  = (record.morningNote  ? record.morningNote  + " | " : "") + "Early dismissal";
      } else {
        if (!record.afternoonIn) {
          return res.status(400).json({
            error: "Cannot time out for afternoon session. You haven't timed in yet."
          });
        }
        if (record.afternoonOut) {
          return res.status(409).json({
            error: `Already timed out for afternoon session at ${record.afternoonOut}`
          });
        }
        record.afternoonOut = currentTime;
        if (withParents)  record.afternoonNote = (record.afternoonNote ? record.afternoonNote + " | " : "") + "Left with parents";
        if (isEarlyOut)   record.afternoonNote = (record.afternoonNote ? record.afternoonNote + " | " : "") + "Early dismissal";
      }

      await record.save();

      const noteMsg = withParents
        ? " — left with parents"
        : isEarlyOut
          ? " (early dismissal)"
          : "";

      return res.status(200).json({
        message: `Successfully timed out for ${session} session${noteMsg}`,
        record,
      });
    }

    return res.status(400).json({ error: "Invalid action type. Use 'timein' or 'timeout'." });

  } catch (err) {
    console.error("❌ CREATE attendance error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// ============================== 
// ✅ GET ATTENDANCE
// ============================== 
const getAttendance = async (req, res) => {
  try {
    const { role, userId, date, eventId } = req.query;
    const filter = {};

    if (date && date !== "all") filter.date = date;
    if (eventId) filter.eventId = eventId;
    if (role === "student" && userId) filter.studentId = userId;

    console.log("📥 GET attendance with filter:", filter);

    const records = await Attendance.find(filter)
      .populate("studentId", "firstName lastName idNumber course yearLevel section photoURL")
      .populate("sscId", "firstName lastName email")
      .populate("eventId", "title startDate endDate morningAttendance afternoonAttendance location participationType families")
      .sort({ createdAt: 1 })
      .lean();

    console.log(`✅ Found ${records.length} attendance records`);
    res.status(200).json(records);
  } catch (err) {
    console.error("❌ GET attendance error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ============================== 
// AUTO MARK ABSENT
// ============================== 
const autoMarkAbsent = async (req, res) => {
  try {
    const { eventId, session, tab, yearLevel, family } = req.body;

    console.log("🔴 AUTO MARK ABSENT REQUEST:", { eventId, session, tab, yearLevel, family });

    if (!eventId) return res.status(400).json({ error: "Event ID required" });
    if (!session || !["morning", "afternoon"].includes(session)) {
      return res.status(400).json({ error: "Valid session required (morning/afternoon)" });
    }
    if (!tab) return res.status(400).json({ error: "Tab selection required" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const today = getPHTDateString();
    console.log(`🔴 Auto-marking ${session} absent for event: ${event.title}, Date: ${today}`);

    let allStudents = await User.find({ role: "student" })
      .select("_id firstName lastName yearLevel course")
      .lean();

    const filteredStudents = filterStudentsByTab(allStudents, tab, yearLevel, family, event);

    if (filteredStudents.length === 0) {
      return res.status(200).json({
        message: "No students found for this selection",
        count: 0,
        totalStudents: 0,
      });
    }

    const existingRecords = await Attendance.find({ eventId, date: today }).lean();
    const recordMap = new Map();
    existingRecords.forEach(r => recordMap.set(r.studentId.toString(), r));

    const bulkOps = [];
    let totalMarked = 0;

    for (const student of filteredStudents) {
      const studentIdStr = student._id.toString();
      const existingRecord = recordMap.get(studentIdStr);

      if (!existingRecord) {
        bulkOps.push({
          insertOne: {
            document: {
              studentId:       student._id,
              sscId:           null,
              eventId,
              date:            today,
              morningStatus:   "absent",
              afternoonStatus: "absent",
            }
          }
        });
        totalMarked++;
      } else {
        let shouldUpdate = false;
        const updateFields = {};

        if (session === "morning" && !existingRecord.morningIn) {
          updateFields.morningStatus = "absent";
          shouldUpdate = true;
          totalMarked++;
        } else if (session === "afternoon" && !existingRecord.afternoonIn) {
          updateFields.afternoonStatus = "absent";
          shouldUpdate = true;
          totalMarked++;
        }

        if (shouldUpdate) {
          bulkOps.push({
            updateOne: {
              filter: { _id: existingRecord._id },
              update: { $set: updateFields }
            }
          });
        }
      }
    }

    if (bulkOps.length > 0) {
      await Attendance.bulkWrite(bulkOps);
    }

    const message = totalMarked > 0
      ? `${totalMarked} student(s) marked absent for ${session} session`
      : `All students already have attendance records for ${session} session`;

    res.status(200).json({ message, count: totalMarked, totalStudents: filteredStudents.length });
  } catch (err) {
    console.error("❌ AUTO absent error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// ============================== 
// UPDATE ATTENDANCE
// ============================== 
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { morningStatus, afternoonStatus } = req.body;

    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ error: "Attendance not found" });

    if (morningStatus && ["present", "late", "absent"].includes(morningStatus)) {
      record.morningStatus = morningStatus;
    }
    if (afternoonStatus && ["present", "late", "absent"].includes(afternoonStatus)) {
      record.afternoonStatus = afternoonStatus;
    }

    await record.save();

    const populated = await Attendance.findById(id)
      .populate("studentId", "firstName lastName idNumber course yearLevel")
      .populate("eventId", "title");

    res.status(200).json({ message: "Attendance updated", record: populated });
  } catch (err) {
    console.error("❌ UPDATE attendance error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ============================== 
// DELETE ATTENDANCE
// ============================== 
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findByIdAndDelete(id);
    if (!record) return res.status(404).json({ error: "Attendance not found" });
    res.status(200).json({ message: "Attendance deleted" });
  } catch (err) {
    console.error("❌ DELETE attendance error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ============================== 
// ✅ EXPORT ATTENDANCE TO EXCEL
// ============================== 
const exportAttendance = async (req, res) => {
  try {
    const { eventId, tab, yearLevel, family } = req.query;

    console.log("📤 EXPORT REQUEST:", { eventId, tab, yearLevel, family });

    if (!eventId) return res.status(400).json({ error: "Event ID required" });
    if (!tab) return res.status(400).json({ error: "Tab selection required" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const startDate = new Date(event.startDate);
    const endDate   = new Date(event.endDate);
    const dates     = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split("T")[0]);
    }

    let allStudents = await User.find({ role: "student" })
      .select("firstName lastName idNumber course yearLevel section")
      .lean();

    const filteredStudents = filterStudentsByTab(allStudents, tab, yearLevel, family, event);

    if (filteredStudents.length === 0) {
      return res.status(404).json({ error: "No students found to export" });
    }

    const records = await Attendance.find({ eventId }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AttendSure";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Attendance", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "No.",        key: "no",        width: 6  },
      { header: "Student ID", key: "idNumber",   width: 14 },
      { header: "Name",       key: "name",       width: 28 },
      { header: "Course",     key: "course",     width: 14 },
      { header: "Year",       key: "year",       width: 10 },
      { header: "Section",    key: "section",    width: 10 },
      { header: "Date",       key: "date",       width: 16 },
      { header: "Session",    key: "session",    width: 12 },
      { header: "Status",     key: "status",     width: 12 },
      { header: "Time In",    key: "timeIn",     width: 16 },
      { header: "Time Out",   key: "timeOut",    width: 16 },
      { header: "Notes",      key: "notes",      width: 22 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 11 };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border    = {
        top:    { style: "thin", color: { argb: "FF93C5FD" } },
        bottom: { style: "thin", color: { argb: "FF93C5FD" } },
        left:   { style: "thin", color: { argb: "FF93C5FD" } },
        right:  { style: "thin", color: { argb: "FF93C5FD" } },
      };
    });
    headerRow.height = 28;

    const statusFill = (status) => {
      if (status === "PRESENT") return { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      if (status === "LATE")    return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      return                           { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    };
    const statusColor = (status) => {
      if (status === "PRESENT") return { argb: "FF065F46" };
      if (status === "LATE")    return { argb: "FF92400E" };
      return                           { argb: "FF991B1B" };
    };

    let rowNum = 1;

    filteredStudents.forEach((student) => {
      const yearSuffix = student.yearLevel === "1" ? "st"
        : student.yearLevel === "2" ? "nd"
        : student.yearLevel === "3" ? "rd" : "th";
      const yearLabel = `${student.yearLevel}${yearSuffix} Year`;

      dates.forEach((date, dateIdx) => {
        const formattedDate = new Date(date).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });

        const record = records.find(
          r => r.studentId?.toString() === student._id.toString() && r.date === date
        );

        const mStatus = (record?.morningStatus   || "absent").toUpperCase();
        const aStatus = (record?.afternoonStatus || "absent").toUpperCase();

        // Morning row
        const mRow = sheet.addRow({
          no:       dateIdx === 0 ? rowNum : "",
          idNumber: dateIdx === 0 ? (student.idNumber || "") : "",
          name:     dateIdx === 0 ? `${student.firstName} ${student.lastName}` : "",
          course:   dateIdx === 0 ? (student.course || "") : "",
          year:     dateIdx === 0 ? yearLabel : "",
          section:  dateIdx === 0 ? (student.section || "B") : "",
          date:     formattedDate,
          session:  "Morning",
          status:   mStatus,
          timeIn:   record?.morningIn   || "—",
          timeOut:  record?.morningOut  || "—",
          notes:    record?.morningNote || "—",
        });

        mRow.height = 20;
        mRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font      = { name: "Arial", size: 10 };
          cell.alignment = { vertical: "middle", horizontal: colNum <= 6 ? "left" : "center" };
          cell.border    = {
            top:    { style: "hair", color: { argb: "FFE2E8F0" } },
            bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
            left:   { style: "hair", color: { argb: "FFE2E8F0" } },
            right:  { style: "hair", color: { argb: "FFE2E8F0" } },
          };
        });

        const mStatusCell = mRow.getCell("status");
        mStatusCell.fill = statusFill(mStatus);
        mStatusCell.font = { name: "Arial", size: 10, bold: true, color: statusColor(mStatus) };

        if (rowNum % 2 === 0) {
          mRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
            if (colNum !== 9) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          });
        }

        // Afternoon row
        const aRow = sheet.addRow({
          no: "", idNumber: "", name: "", course: "", year: "", section: "",
          date:    formattedDate,
          session: "Afternoon",
          status:  aStatus,
          timeIn:  record?.afternoonIn   || "—",
          timeOut: record?.afternoonOut  || "—",
          notes:   record?.afternoonNote || "—",
        });

        aRow.height = 20;
        aRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font      = { name: "Arial", size: 10 };
          cell.alignment = { vertical: "middle", horizontal: colNum <= 6 ? "left" : "center" };
          cell.border    = {
            top:    { style: "hair", color: { argb: "FFE2E8F0" } },
            bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
            left:   { style: "hair", color: { argb: "FFE2E8F0" } },
            right:  { style: "hair", color: { argb: "FFE2E8F0" } },
          };
        });

        const aStatusCell = aRow.getCell("status");
        aStatusCell.fill = statusFill(aStatus);
        aStatusCell.font = { name: "Arial", size: 10, bold: true, color: statusColor(aStatus) };

        if (rowNum % 2 === 0) {
          aRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
            if (colNum !== 9) aRow.getCell(colNum).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          });
        }
      });

      rowNum++;
    });

    let filename = `attendance_${event.title.replace(/\s+/g, "_")}`;
    if (tab === "family" && family && family !== "all") filename += `_Family_${family}`;
    else if (tab === "seniorHigh" && yearLevel && yearLevel !== "all") filename += `_Grade_${yearLevel}`;
    else if (tab === "college" && yearLevel && yearLevel !== "all") filename += `_Year_${yearLevel}`;
    else if (tab) filename += `_${tab}`;
    filename += ".xlsx";

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.status(200).end(buffer);

    console.log(`✅ Excel export completed: ${buffer.length} bytes`);
  } catch (err) {
    console.error("❌ EXPORT error:", err);
    res.status(500).json({ error: "Export failed: " + err.message });
  }
};

module.exports = {
  createAttendance,
  getAttendance,
  autoMarkAbsent,
  updateAttendance,
  deleteAttendance,
  exportAttendance,
};