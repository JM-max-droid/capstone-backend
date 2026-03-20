const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const User = require("../models/User");
const ExcelJS = require("exceljs");

// ============================== 
// ✅ HELPER: Filter students by tab and criteria
// ============================== 
const filterStudentsByTab = (students, tab, yearLevel, family, event, course, section) => {
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
      if (course && course !== "all") {
        const sk = course.replace(".", "").replace(" ", "").toUpperCase();
        if (!(s.course || "").toUpperCase().replace(".", "").replace(" ", "").includes(sk)) return false;
      }
      if (section && section !== "all" && (s.section || "") !== section) return false;
      return true;
    }

    if (tab === "college") {
      if (isFamily) return false;
      const inRange = yl >= 1 && yl <= 4;
      if (!inRange) return false;
      if (yearLevel && yearLevel !== "all" && String(yl) !== yearLevel) return false;
      if (course && course !== "all" && !(s.course || "").toUpperCase().includes(course.toUpperCase())) return false;
      if (section && section !== "all" && (s.section || "") !== section) return false;
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
    if (!timeStr || typeof timeStr !== "string") {
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

    console.log(`✅ Parsed time: ${timeStr} -> ${hours}:${String(minutes).padStart(2, "0")}`);
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
  console.log(`🇵🇭 PHT: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} | UTC: ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`);
  return hours * 60 + minutes;
};

// ============================== 
// ✅ Get PHT date string (YYYY-MM-DD)
// ============================== 
const getPHTDateString = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = pht.getUTCFullYear();
  const month = String(pht.getUTCMonth() + 1).padStart(2, "0");
  const day = String(pht.getUTCDate()).padStart(2, "0");
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
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} ${period}`;
};

// ============================== 
// ✅ Check if all attendance windows for an event have fully ended.
//    FIX: Now correctly returns false when current time is BEFORE
//         any window has started (early attendance scenario).
// ============================== 
const areAllWindowsClosed = (event) => {
  const currentMinutes = getPHTMinutes();

  // ── Collect earliest window start ──────────────────────────────────────
  let earliestWindowStart = Infinity;

  if (event.morningAttendance?.start) {
    const start = parseTime(event.morningAttendance.start);
    if (start) {
      earliestWindowStart = Math.min(earliestWindowStart, start.hours * 60 + start.minutes);
    }
  }
  if (event.afternoonAttendance?.start) {
    const start = parseTime(event.afternoonAttendance.start);
    if (start) {
      earliestWindowStart = Math.min(earliestWindowStart, start.hours * 60 + start.minutes);
    }
  }

  // ✅ KEY FIX: If we're still before the earliest window start,
  //    the day hasn't started yet — definitely NOT closed.
  if (earliestWindowStart !== Infinity && currentMinutes < earliestWindowStart) {
    console.log(
      `⏳ Current time (${currentMinutes} min) is before earliest window start (${earliestWindowStart} min). Attendance NOT closed.`
    );
    return false;
  }

  // ── Collect latest window end ───────────────────────────────────────────
  let latestWindowEnd = -1;

  if (event.morningAttendance?.end) {
    const end = parseTime(event.morningAttendance.end);
    const allotted = event.morningAttendance?.allottedTime || 30;
    if (end) latestWindowEnd = Math.max(latestWindowEnd, end.hours * 60 + end.minutes + allotted);
  }
  if (event.morningAttendance?.timeout) {
    const t = parseTime(event.morningAttendance.timeout);
    if (t) latestWindowEnd = Math.max(latestWindowEnd, t.hours * 60 + t.minutes + 60);
  }
  if (event.afternoonAttendance?.end) {
    const end = parseTime(event.afternoonAttendance.end);
    const allotted = event.afternoonAttendance?.allottedTime || 30;
    if (end) latestWindowEnd = Math.max(latestWindowEnd, end.hours * 60 + end.minutes + allotted);
  }
  if (event.afternoonAttendance?.timeout) {
    const t = parseTime(event.afternoonAttendance.timeout);
    if (t) latestWindowEnd = Math.max(latestWindowEnd, t.hours * 60 + t.minutes + 60);
  }

  if (latestWindowEnd === -1) return false;

  const isClosed = currentMinutes > latestWindowEnd;
  console.log(
    `🔒 areAllWindowsClosed: current=${currentMinutes} min, latestEnd=${latestWindowEnd} min → ${isClosed ? "CLOSED" : "OPEN"}`
  );
  return isClosed;
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
// ✅ BUILD DISMISSAL NOTE
// ============================== 
const buildDismissalNote = (existingNote, dismissalNote, withParents, isEarlyOut) => {
  const parts = [];

  if (existingNote) parts.push(existingNote);

  if (dismissalNote && dismissalNote.trim()) {
    parts.push(dismissalNote.trim());
  } else if (withParents) {
    parts.push("Left with parents");
  }

  if (isEarlyOut && !dismissalNote && !withParents) {
    parts.push("Early dismissal");
  }

  return parts.length > 0 ? parts.join(" | ") : null;
};

// ============================== 
// ✅ CREATE ATTENDANCE
// ============================== 
const createAttendance = async (req, res) => {
  try {
    const { studentId, sscId, eventId, role, actionType, withParents, dismissalNote } = req.body;

    console.log("📝 Attendance request:", { studentId, sscId, eventId, role, actionType, withParents, dismissalNote });

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

    const sessions = getSessionInfo(event);

    let record = await Attendance.findOne({ studentId, eventId, date: today });

    // ── TIME IN ──────────────────────────────────────────────────────────────
    if (actionType === "timein") {

      if (areAllWindowsClosed(event)) {
        return res.status(410).json({
          error: "ATTENDANCE_CLOSED",
          message: "All attendance windows for today have ended. No further attendance can be recorded for this event.",
        });
      }

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

      // Check existing record FIRST before session validation.
      if (!record) {
        return res.status(400).json({
          error: "Cannot time out. No attendance record found. Please time in first."
        });
      }

      const timeOutSession = sessions.find(s => s.type === "out");

      if (!timeOutSession) {
        // No active timeout window but student already timed in —
        // find which session needs a timeout and allow it through.
        let session = null;
        let isEarlyOut = true;

        if (record.morningIn && !record.morningOut) {
          session = "morning";
        } else if (record.afternoonIn && !record.afternoonOut) {
          session = "afternoon";
        }

        if (!session) {
          return res.status(400).json({
            error: "No active time-out window available at this time."
          });
        }

        console.log(`⚠️ No active timeout window but found existing ${session} time-in — allowing timeout (event may have been edited)`);

        if (session === "morning") {
          if (record.morningOut) {
            return res.status(409).json({
              error: `Already timed out for morning session at ${record.morningOut}`
            });
          }
          record.morningOut  = currentTime;
          record.morningNote = buildDismissalNote(record.morningNote, dismissalNote, withParents, isEarlyOut);
        } else {
          if (record.afternoonOut) {
            return res.status(409).json({
              error: `Already timed out for afternoon session at ${record.afternoonOut}`
            });
          }
          record.afternoonOut  = currentTime;
          record.afternoonNote = buildDismissalNote(record.afternoonNote, dismissalNote, withParents, isEarlyOut);
        }

        await record.save();

        let noteMsg = "";
        if (dismissalNote && dismissalNote.trim()) {
          noteMsg = ` — ${dismissalNote.trim()}`;
        } else if (withParents) {
          noteMsg = " — left with parents";
        }

        return res.status(200).json({
          message: `Successfully timed out for ${session} session${noteMsg}`,
          record,
        });
      }

      // Normal timeout flow (active window exists)
      const { session, isEarlyOut } = timeOutSession;

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

        record.morningOut  = currentTime;
        record.morningNote = buildDismissalNote(
          record.morningNote,
          dismissalNote,
          withParents,
          isEarlyOut,
        );

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

        record.afternoonOut  = currentTime;
        record.afternoonNote = buildDismissalNote(
          record.afternoonNote,
          dismissalNote,
          withParents,
          isEarlyOut,
        );
      }

      await record.save();

      let noteMsg = "";
      if (dismissalNote && dismissalNote.trim()) {
        noteMsg = ` — ${dismissalNote.trim()}`;
      } else if (withParents) {
        noteMsg = " — left with parents";
      } else if (isEarlyOut) {
        noteMsg = " (early dismissal)";
      }

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

    // ✅ FIX: userId can be a MongoDB ObjectId OR an idNumber (plain number).
    if (userId) {
      const isObjectId = /^[a-f\d]{24}$/i.test(userId);
      if (isObjectId) {
        filter.studentId = userId;
      } else {
        const student = await User.findOne({ idNumber: userId }).select("_id").lean();
        if (student) {
          filter.studentId = student._id;
        } else {
          return res.status(200).json([]);
        }
      }
    }

    console.log("📥 GET attendance with filter:", filter);

    const records = await Attendance.find(filter)
      .populate("studentId", "firstName lastName idNumber course yearLevel section photoURL")
      .populate("sscId", "firstName lastName email")
      .populate("eventId", "title startDate endDate morningAttendance afternoonAttendance location participationType families fines")
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
// DELETE ATTENDANCE (single record)
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
// ✅ DELETE ALL ATTENDANCE FOR AN EVENT (cascade)
// ==============================
const deleteAttendanceByEvent = async (eventId) => {
  try {
    const result = await Attendance.deleteMany({ eventId });
    console.log(`🗑️ Cascade deleted ${result.deletedCount} attendance records for event ${eventId}`);
    return result.deletedCount;
  } catch (err) {
    console.error("❌ Cascade delete attendance error:", err);
    throw err;
  }
};

// ============================== 
// ✅ EXPORT ATTENDANCE TO EXCEL
//    Exports EXACTLY what is visible on screen:
//    - Respects tab (college / seniorHigh / family)
//    - Respects course / yearLevel / section / strand / family dropdowns
//    - Respects specific date when in history mode (date param)
//    - Respects specific session (morning / afternoon) (session param)
//    - Only students who have matching records are included
// ============================== 
const exportAttendance = async (req, res) => {
  try {
    const {
      eventId,
      tab,
      yearLevel,
      course,
      section,
      family,
      date,    // specific date from history picker (YYYY-MM-DD), optional
      session, // "morning" or "afternoon", optional
    } = req.query;

    console.log("📤 EXPORT REQUEST:", { eventId, tab, yearLevel, course, section, family, date, session });

    if (!eventId) return res.status(400).json({ error: "Event ID required" });
    if (!tab)     return res.status(400).json({ error: "Tab selection required" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // ── Build date range to export ─────────────────────────────────────────
    // If a specific date is provided, export only that date.
    // Otherwise export all dates in the event range.
    let datesToExport = [];

    if (date) {
      datesToExport = [date];
    } else {
      const startDate = new Date(event.startDate);
      const endDate   = new Date(event.endDate);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        datesToExport.push(new Date(d).toISOString().split("T")[0]);
      }
    }

    // ── Determine which sessions to show ──────────────────────────────────
    // If a specific session is provided, show only that session.
    // Otherwise show both morning and afternoon.
    const sessionsToExport = session && ["morning", "afternoon"].includes(session)
      ? [session]
      : ["morning", "afternoon"];

    const totalFinePerDay = parseFloat(event.fines) || 0;
    const finePerSession  = totalFinePerDay > 0 ? totalFinePerDay / 2 : 0;
    const hasFines        = finePerSession > 0;

    // ── Fetch attendance records ───────────────────────────────────────────
    const dbFilter = { eventId };
    if (date) dbFilter.date = date;

    const allRecords = await Attendance.find(dbFilter)
      .populate("studentId", "firstName lastName idNumber course yearLevel section photoURL")
      .lean();

    // ── Mirror frontend filter logic exactly ──────────────────────────────
    const filteredRecords = allRecords.filter(r => {
      const s = r.studentId;
      if (!s) return false;

      const yl          = parseInt(s.yearLevel) || 0;
      const isFamily    = s.course?.toLowerCase().includes("family");
      const courseUpper = (s.course || "").toUpperCase();

      if (tab === "family") {
        if (!isFamily) return false;
        if (
          event.participationType === "FAMILY" &&
          event.families &&
          event.families.length > 0
        ) {
          const fNum = s.course?.match(/\d+/)?.[0];
          if (!fNum || !event.families.map(String).includes(fNum)) return false;
          if (family && family !== "all" && fNum !== family) return false;
        } else if (family && family !== "all") {
          const fNum = s.course?.match(/\d+/)?.[0];
          if (fNum !== family) return false;
        }
        return true;
      }

      if (tab === "seniorHigh") {
        if (isFamily || yl < 11 || yl > 12) return false;
        if (course && course !== "all") {
          const sk = course.replace(".", "").replace(" ", "").toUpperCase();
          if (!courseUpper.replace(".", "").replace(" ", "").includes(sk)) return false;
        }
        if (yearLevel && yearLevel !== "all" && String(yl) !== yearLevel) return false;
        if (section   && section   !== "all" && (s.section || "") !== section) return false;
        return true;
      }

      // college (default)
      if (isFamily || yl < 1 || yl > 4) return false;
      if (course    && course    !== "all" && !courseUpper.includes(course.toUpperCase())) return false;
      if (yearLevel && yearLevel !== "all" && String(yl) !== yearLevel) return false;
      if (section   && section   !== "all" && (s.section || "") !== section) return false;
      return true;
    });

    if (filteredRecords.length === 0) {
      return res.status(404).json({
        error: "No attendance records found for the selected filters. Nothing to export.",
      });
    }

    // ── Collect unique students ────────────────────────────────────────────
    const studentMap = new Map();
    filteredRecords.forEach(r => {
      const id = r.studentId?._id?.toString();
      if (id && !studentMap.has(id)) studentMap.set(id, r.studentId);
    });
    const uniqueStudents = Array.from(studentMap.values());

    // Fast lookup: `${studentId}_${date}` → record
    const recordLookup = new Map();
    filteredRecords.forEach(r => {
      const key = `${r.studentId?._id?.toString()}_${r.date}`;
      recordLookup.set(key, r);
    });

    // ── Build Excel workbook ───────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AttendSure";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Attendance", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const columns = [
      { header: "No.",        key: "no",       width: 6  },
      { header: "Student ID", key: "idNumber",  width: 14 },
      { header: "Name",       key: "name",      width: 28 },
      { header: "Course",     key: "course",    width: 14 },
      { header: "Year",       key: "year",      width: 10 },
      { header: "Section",    key: "section",   width: 10 },
      { header: "Date",       key: "date",      width: 16 },
      { header: "Session",    key: "session",   width: 12 },
      { header: "Status",     key: "status",    width: 12 },
      { header: "Time In",    key: "timeIn",    width: 16 },
      { header: "Time Out",   key: "timeOut",   width: 16 },
      { header: "Notes",      key: "notes",     width: 22 },
    ];
    if (hasFines) {
      columns.push({ header: `Fine (₱${finePerSession})`, key: "fine", width: 14 });
    }
    sheet.columns = columns;

    // ── Style header row ───────────────────────────────────────────────────
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
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

    // ── Color helpers ──────────────────────────────────────────────────────
    const statusFill = status => {
      if (status === "PRESENT") return { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      if (status === "LATE")    return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      return                           { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    };
    const statusColor = status => {
      if (status === "PRESENT") return { argb: "FF065F46" };
      if (status === "LATE")    return { argb: "FF92400E" };
      return                           { argb: "FF991B1B" };
    };
    const fineFill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    const fineColor = { argb: "FF9A3412" };

    const applyBaseStyle = (row, isEvenStudent) => {
      row.height = 20;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font      = { name: "Arial", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: colNum <= 6 ? "left" : "center" };
        cell.border    = {
          top:    { style: "hair", color: { argb: "FFE2E8F0" } },
          bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
          left:   { style: "hair", color: { argb: "FFE2E8F0" } },
          right:  { style: "hair", color: { argb: "FFE2E8F0" } },
        };
        const statusColIdx = 9;
        const fineColIdx   = hasFines ? 13 : -1;
        if (isEvenStudent && colNum !== statusColIdx && colNum !== fineColIdx) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      });
    };

    // ── Write student rows ─────────────────────────────────────────────────
    let rowNum = 1;

    uniqueStudents.forEach(student => {
      const yl = parseInt(student.yearLevel) || 0;
      const yearSuffix = student.yearLevel === "1" ? "st"
        : student.yearLevel === "2" ? "nd"
        : student.yearLevel === "3" ? "rd" : "th";

      let yearLabel;
      if (yl >= 11 && yl <= 12)    yearLabel = `Grade ${yl}`;
      else if (yl >= 1 && yl <= 4) yearLabel = `${student.yearLevel}${yearSuffix} Year`;
      else                          yearLabel = student.yearLevel || "—";

      const isEvenStudent = rowNum % 2 === 0;
      let isFirstRow = true;

      datesToExport.forEach(d => {
        const formattedDate = new Date(d).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });

        const record = recordLookup.get(`${student._id?.toString()}_${d}`);

        sessionsToExport.forEach(sess => {
          const rawStatus = sess === "morning"
            ? (record?.morningStatus   || "absent")
            : (record?.afternoonStatus || "absent");
          const status  = rawStatus.toUpperCase();
          const timeIn  = sess === "morning" ? (record?.morningIn   || "—") : (record?.afternoonIn   || "—");
          const timeOut = sess === "morning" ? (record?.morningOut  || "—") : (record?.afternoonOut  || "—");
          const notes   = sess === "morning" ? (record?.morningNote || "—") : (record?.afternoonNote || "—");
          const fine    = hasFines && status === "ABSENT" ? finePerSession : 0;

          const rowData = {
            no:       isFirstRow ? rowNum : "",
            idNumber: isFirstRow ? (student.idNumber || "") : "",
            name:     isFirstRow ? `${student.firstName} ${student.lastName}` : "",
            course:   isFirstRow ? (student.course || "") : "",
            year:     isFirstRow ? yearLabel : "",
            section:  isFirstRow ? (student.section || "—") : "",
            date:     formattedDate,
            session:  sess.charAt(0).toUpperCase() + sess.slice(1),
            status,
            timeIn,
            timeOut,
            notes,
          };
          if (hasFines) rowData.fine = fine > 0 ? `₱${fine.toFixed(2)}` : "—";

          const row = sheet.addRow(rowData);
          applyBaseStyle(row, isEvenStudent);

          const statusCell = row.getCell("status");
          statusCell.fill = statusFill(status);
          statusCell.font = { name: "Arial", size: 10, bold: true, color: statusColor(status) };

          if (hasFines) {
            const fineCell = row.getCell("fine");
            if (fine > 0) {
              fineCell.fill = fineFill;
              fineCell.font = { name: "Arial", size: 10, bold: true, color: fineColor };
            } else {
              fineCell.font = { name: "Arial", size: 10, color: { argb: "FF94A3B8" } };
            }
          }

          isFirstRow = false;
        });
      });

      // ── Per-student total fines row ────────────────────────────────────
      if (hasFines) {
        let totalFine = 0;
        datesToExport.forEach(d => {
          const record = recordLookup.get(`${student._id?.toString()}_${d}`);
          sessionsToExport.forEach(sess => {
            const st = sess === "morning"
              ? (record?.morningStatus   || "absent").toUpperCase()
              : (record?.afternoonStatus || "absent").toUpperCase();
            if (st === "ABSENT") totalFine += finePerSession;
          });
        });

        if (totalFine > 0) {
          const totalRow = sheet.addRow({
            no: "", idNumber: "", name: "", course: "", year: "", section: "",
            date: "", session: "TOTAL FINE", status: "", timeIn: "", timeOut: "",
            notes: `${student.firstName} ${student.lastName}`,
            fine:  `₱${totalFine.toFixed(2)}`,
          });
          totalRow.height = 22;
          totalRow.eachCell({ includeEmpty: true }, cell => {
            cell.font      = { name: "Arial", size: 10, bold: true, italic: true, color: { argb: "FF7C2D12" } };
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF1F1" } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.border    = {
              top:    { style: "medium", color: { argb: "FFFCA5A5" } },
              bottom: { style: "medium", color: { argb: "FFFCA5A5" } },
              left:   { style: "hair",   color: { argb: "FFE2E8F0" } },
              right:  { style: "hair",   color: { argb: "FFE2E8F0" } },
            };
          });
        }

        sheet.addRow({}); // spacer between students
      }

      rowNum++;
    });

    // ── Grand total fines ──────────────────────────────────────────────────
    if (hasFines) {
      let grandTotal = 0;
      uniqueStudents.forEach(student => {
        datesToExport.forEach(d => {
          const record = recordLookup.get(`${student._id?.toString()}_${d}`);
          sessionsToExport.forEach(sess => {
            const st = sess === "morning"
              ? (record?.morningStatus   || "absent").toUpperCase()
              : (record?.afternoonStatus || "absent").toUpperCase();
            if (st === "ABSENT") grandTotal += finePerSession;
          });
        });
      });

      const summaryRow = sheet.addRow({
        no: "", idNumber: "GRAND TOTAL",
        name: `All ${uniqueStudents.length} student(s)`,
        course: "", year: "", section: "", date: "", session: "",
        status: "", timeIn: "", timeOut: "",
        notes: "Total fines across all students",
        fine:  `₱${grandTotal.toFixed(2)}`,
      });
      summaryRow.height = 28;
      summaryRow.eachCell({ includeEmpty: true }, cell => {
        cell.font      = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7F1D1D" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    }

    // ── Build filename ─────────────────────────────────────────────────────
    let filename = `attendance_${event.title.replace(/\s+/g, "_")}`;
    if (tab === "family") {
      filename += `_Family${family && family !== "all" ? `_${family}` : ""}`;
    } else if (tab === "seniorHigh") {
      filename += `_SeniorHigh`;
      if (course    && course    !== "all") filename += `_${course.replace(/\s/g, "")}`;
      if (yearLevel && yearLevel !== "all") filename += `_Grade${yearLevel}`;
      if (section   && section   !== "all") filename += `_Sec${section}`;
    } else {
      filename += `_College`;
      if (course    && course    !== "all") filename += `_${course}`;
      if (yearLevel && yearLevel !== "all") filename += `_Year${yearLevel}`;
      if (section   && section   !== "all") filename += `_Sec${section}`;
    }
    if (date)    filename += `_${date}`;
    if (session) filename += `_${session}`;
    filename += ".xlsx";

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length",      buffer.length);
    res.status(200).end(buffer);

    console.log(
      `✅ Excel export done: ${buffer.length} bytes | ` +
      `${uniqueStudents.length} students | dates: [${datesToExport.join(", ")}] | ` +
      `sessions: [${sessionsToExport.join(", ")}] | Fines: ${hasFines ? `₱${finePerSession}/session` : "none"}`
    );
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
  deleteAttendanceByEvent,
  exportAttendance,
};