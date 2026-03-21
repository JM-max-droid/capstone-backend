const Attendance = require("../models/Attendance");
const Event = require("../models/Event");
const User = require("../models/User");
const ExcelJS = require("exceljs");

// ==============================
// HELPER: Filter students by tab and criteria
// ==============================
const filterStudentsByTab = (students, tab, yearLevel, family, event, course, section) => {
  return students.filter(s => {
    const yl = parseInt(s.yearLevel) || 0;
    const isFamily = s.course?.toLowerCase().includes("family");

    if (tab === "family") {
      if (!isFamily) return false;
      if (event.participationType === "FAMILY" && event.families?.length > 0) {
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
      if (isFamily || yl < 11 || yl > 12) return false;
      if (yearLevel && yearLevel !== "all" && String(yl) !== yearLevel) return false;
      if (course && course !== "all") {
        const sk = course.replace(".", "").replace(" ", "").toUpperCase();
        if (!(s.course || "").toUpperCase().replace(".", "").replace(" ", "").includes(sk)) return false;
      }
      if (section && section !== "all" && (s.section || "") !== section) return false;
      return true;
    }

    // college (default)
    if (isFamily || yl < 1 || yl > 4) return false;
    if (yearLevel && yearLevel !== "all" && String(yl) !== yearLevel) return false;
    if (course && course !== "all" && !(s.course || "").toUpperCase().includes(course.toUpperCase())) return false;
    if (section && section !== "all" && (s.section || "") !== section) return false;
    return true;
  });
};

// ==============================
// Parse time string — handles "8:03 AM" format reliably
// ==============================
const parseTime = (timeStr) => {
  try {
    if (!timeStr || typeof timeStr !== "string") return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === "AM") {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  } catch {
    return null;
  }
};

// ==============================
// Get PHT (UTC+8) current minutes since midnight
// ==============================
const getPHTMinutes = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return pht.getUTCHours() * 60 + pht.getUTCMinutes();
};

// ==============================
// Get PHT date string (YYYY-MM-DD)
// ==============================
const getPHTDateString = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = pht.getUTCFullYear();
  const m = String(pht.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pht.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// ==============================
// Get PHT time string for storing in DB (e.g. "08:03:45 AM")
// ==============================
const getPHTTimeString = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  let hours = pht.getUTCHours();
  const minutes = pht.getUTCMinutes();
  const seconds = pht.getUTCSeconds();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} ${period}`;
};

// ==============================
// Check if all attendance windows for an event have fully ended
// ==============================
const areAllWindowsClosed = (event) => {
  const today = getPHTDateString();
  const eventStart = event.startDate?.split("T")[0];
  const eventEnd   = event.endDate?.split("T")[0];
  if (!eventStart || !eventEnd || today < eventStart || today > eventEnd) return true;

  const currentMinutes = getPHTMinutes();

  let earliestWindowStart = Infinity;
  if (event.morningAttendance?.start) {
    const s = parseTime(event.morningAttendance.start);
    if (s) earliestWindowStart = Math.min(earliestWindowStart, s.hours * 60 + s.minutes);
  }
  if (event.afternoonAttendance?.start) {
    const s = parseTime(event.afternoonAttendance.start);
    if (s) earliestWindowStart = Math.min(earliestWindowStart, s.hours * 60 + s.minutes);
  }

  const earlyBuffer = 60;
  if (earliestWindowStart !== Infinity && currentMinutes < (earliestWindowStart - earlyBuffer)) {
    return false;
  }

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
    if (end) {
      const rawEnd = end.hours * 60 + end.minutes + allotted;
      latestWindowEnd = Math.max(latestWindowEnd, Math.min(rawEnd, 1439));
    }
  }
  if (event.afternoonAttendance?.timeout) {
    const t = parseTime(event.afternoonAttendance.timeout);
    if (t) {
      const rawEnd = t.hours * 60 + t.minutes + 60;
      latestWindowEnd = Math.max(latestWindowEnd, Math.min(rawEnd, 1439));
    }
  }

  if (latestWindowEnd === -1) return false;

  const isClosed = currentMinutes > latestWindowEnd;
  console.log(`🔒 areAllWindowsClosed: current=${currentMinutes} latestEnd=${latestWindowEnd} → ${isClosed ? "CLOSED" : "OPEN"}`);
  return isClosed;
};

// ==============================
// Get session info with corrected window bounds
// ==============================
const getSessionInfo = (event) => {
  try {
    const currentMinutes = getPHTMinutes();
    const earlyBuffer = 60;
    const sessions = [];

    // ── MORNING TIME-IN ────────────────────────────────────────────────────
    if (event.morningAttendance?.start && event.morningAttendance?.end) {
      const start = parseTime(event.morningAttendance.start);
      const end   = parseTime(event.morningAttendance.end);

      if (start && end) {
        const startMin  = start.hours * 60 + start.minutes;
        const endMin    = end.hours * 60 + end.minutes;
        const allotted  = event.morningAttendance.allottedTime || 30;
        const lateLimit = endMin + allotted;
        const windowOpen = Math.max(0, startMin - earlyBuffer);

        if (currentMinutes >= windowOpen && currentMinutes <= lateLimit) {
          const isEarly = currentMinutes < startMin;
          const status  = currentMinutes > endMin ? "late" : "present";
          sessions.push({ session: "morning", type: "in", status, isLate: status === "late", isEarly });
        }
      }
    }

    // ── MORNING TIME-OUT ───────────────────────────────────────────────────
    if (event.morningAttendance?.timeout) {
      const timeout = parseTime(event.morningAttendance.timeout);
      if (timeout) {
        const timeoutMin  = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd  = timeoutMin + 60;
        const isEarlyOut  = currentMinutes >= 0 && currentMinutes < timeoutMin;
        const isNormalOut = currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd;
        if (isEarlyOut || isNormalOut) {
          sessions.push({ session: "morning", type: "out", status: "present", isLate: false, isEarlyOut });
        }
      }
    }

    // ── AFTERNOON TIME-IN ──────────────────────────────────────────────────
    if (event.afternoonAttendance?.start && event.afternoonAttendance?.end) {
      const start = parseTime(event.afternoonAttendance.start);
      const end   = parseTime(event.afternoonAttendance.end);

      if (start && end) {
        const startMin = start.hours * 60 + start.minutes;
        let   endMin   = end.hours * 60 + end.minutes;
        if (endMin < startMin) endMin = Math.min(endMin + 24 * 60, 1439);

        const allotted   = event.afternoonAttendance.allottedTime || 30;
        const lateLimit  = Math.min(endMin + allotted, 1439);
        const windowOpen = Math.max(12 * 60, startMin - earlyBuffer);

        if (currentMinutes >= windowOpen && currentMinutes <= lateLimit) {
          const isEarly = currentMinutes < startMin;
          const status  = currentMinutes > endMin ? "late" : "present";
          sessions.push({ session: "afternoon", type: "in", status, isLate: status === "late", isEarly });
        }
      }
    }

    // ── AFTERNOON TIME-OUT ─────────────────────────────────────────────────
    if (event.afternoonAttendance?.timeout) {
      const timeout = parseTime(event.afternoonAttendance.timeout);
      if (timeout) {
        const timeoutMin  = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd  = Math.min(timeoutMin + 60, 1439);
        const noonMin     = 12 * 60;
        const isEarlyOut  = currentMinutes >= noonMin && currentMinutes < timeoutMin;
        const isNormalOut = currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd;
        if (isEarlyOut || isNormalOut) {
          sessions.push({ session: "afternoon", type: "out", status: "present", isLate: false, isEarlyOut });
        }
      }
    }

    console.log(`✅ Active sessions: [${sessions.map(s => `${s.session} ${s.type}${s.isEarly ? "(early)" : ""}${s.isEarlyOut ? "(earlyOut)" : ""}`).join(", ")}]`);
    return sessions;
  } catch (err) {
    console.error("❌ getSessionInfo error:", err);
    return [];
  }
};

// ==============================
// Build dismissal note
// ==============================
const buildDismissalNote = (existingNote, dismissalNote, withParents, isEarlyOut) => {
  const parts = [];
  if (existingNote) parts.push(existingNote);
  if (dismissalNote?.trim()) {
    parts.push(dismissalNote.trim());
  } else if (withParents) {
    parts.push("Left with parents");
  } else if (isEarlyOut) {
    parts.push("Early dismissal");
  }
  return parts.length > 0 ? parts.join(" | ") : null;
};

// ==============================
// CREATE ATTENDANCE
// ==============================
const createAttendance = async (req, res) => {
  try {
    const { studentId, sscId, eventId, role, actionType, withParents, dismissalNote } = req.body;
    console.log("📝 Attendance request:", { studentId, sscId, eventId, role, actionType });

    if (role !== "ssc") return res.status(403).json({ error: "Access denied. SSC only." });
    if (!studentId || !sscId || !eventId || !actionType)
      return res.status(400).json({ error: "Missing required fields" });

    const student = await User.findById(studentId);
    if (!student || student.role !== "student")
      return res.status(400).json({ error: "Invalid student" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const today       = getPHTDateString();
    const currentTime = getPHTTimeString();
    console.log(`⏰ PHT time: ${currentTime}, date: ${today}`);

    const eventStart = event.startDate?.split("T")[0];
    const eventEnd   = event.endDate?.split("T")[0];
    if (!eventStart || !eventEnd || today < eventStart || today > eventEnd) {
      return res.status(410).json({
        error: "ATTENDANCE_CLOSED",
        message: "This event is not active today. Attendance can only be recorded during the event dates.",
      });
    }

    const sessions = getSessionInfo(event);
    let record = await Attendance.findOne({ studentId, eventId, date: today });

    // ── TIME IN ────────────────────────────────────────────────────────────
    if (actionType === "timein") {
      if (areAllWindowsClosed(event)) {
        return res.status(410).json({
          error: "ATTENDANCE_CLOSED",
          message: "All attendance windows for today have ended.",
        });
      }

      const timeInSession = sessions.find(s => s.type === "in");
      if (!timeInSession) {
        return res.status(400).json({ error: "No active time-in window at this time." });
      }

      const { session, status, isEarly } = timeInSession;

      if (!record) {
        record = new Attendance({
          studentId, sscId, eventId, date: today,
          morningStatus: "absent", afternoonStatus: "absent",
        });
      }

      if (session === "morning") {
        if (record.morningIn) {
          return res.status(409).json({
            error: `Already timed in for morning at ${record.morningIn}. Status: ${record.morningStatus.toUpperCase()}`,
          });
        }
        record.morningIn     = currentTime;
        record.morningStatus = status;
        if (isEarly) record.morningNote = "Early arrival";
      } else {
        if (record.afternoonIn) {
          return res.status(409).json({
            error: `Already timed in for afternoon at ${record.afternoonIn}. Status: ${record.afternoonStatus.toUpperCase()}`,
          });
        }
        record.afternoonIn     = currentTime;
        record.afternoonStatus = status;
        if (isEarly) record.afternoonNote = "Early arrival";
      }

      await record.save();
      const earlyMsg = isEarly ? ` (early arrival — before the ${session} window opens)` : "";
      return res.status(201).json({
        message: `Timed in as ${status.toUpperCase()} for ${session} session${earlyMsg}`,
        record,
      });
    }

    // ── TIME OUT ───────────────────────────────────────────────────────────
    if (actionType === "timeout") {
      if (!record) {
        return res.status(400).json({ error: "Cannot time out — no attendance record found. Please time in first." });
      }

      const timeOutSession = sessions.find(s => s.type === "out");

      if (!timeOutSession) {
        let session = null;
        if (record.morningIn && !record.morningOut)          session = "morning";
        else if (record.afternoonIn && !record.afternoonOut) session = "afternoon";

        if (!session) {
          return res.status(400).json({ error: "No active time-out window at this time." });
        }

        console.log(`⚠️ No active timeout window — allowing ${session} timeout (event may have been edited)`);
        if (session === "morning") {
          if (record.morningOut) return res.status(409).json({ error: `Already timed out for morning at ${record.morningOut}` });
          record.morningOut  = currentTime;
          record.morningNote = buildDismissalNote(record.morningNote, dismissalNote, withParents, true);
        } else {
          if (record.afternoonOut) return res.status(409).json({ error: `Already timed out for afternoon at ${record.afternoonOut}` });
          record.afternoonOut  = currentTime;
          record.afternoonNote = buildDismissalNote(record.afternoonNote, dismissalNote, withParents, true);
        }

        await record.save();
        const noteMsg = dismissalNote?.trim() ? ` — ${dismissalNote.trim()}` : withParents ? " — left with parents" : "";
        return res.status(200).json({ message: `Timed out for ${session} session${noteMsg}`, record });
      }

      const { session, isEarlyOut } = timeOutSession;

      if (session === "morning") {
        if (!record.morningIn)  return res.status(400).json({ error: "Cannot time out for morning — haven't timed in yet." });
        if (record.morningOut)  return res.status(409).json({ error: `Already timed out for morning at ${record.morningOut}` });
        record.morningOut  = currentTime;
        record.morningNote = buildDismissalNote(record.morningNote, dismissalNote, withParents, isEarlyOut);
      } else {
        if (!record.afternoonIn)  return res.status(400).json({ error: "Cannot time out for afternoon — haven't timed in yet." });
        if (record.afternoonOut)  return res.status(409).json({ error: `Already timed out for afternoon at ${record.afternoonOut}` });
        record.afternoonOut  = currentTime;
        record.afternoonNote = buildDismissalNote(record.afternoonNote, dismissalNote, withParents, isEarlyOut);
      }

      await record.save();
      const noteMsg = dismissalNote?.trim()
        ? ` — ${dismissalNote.trim()}`
        : withParents  ? " — left with parents"
        : isEarlyOut   ? " (early dismissal)"
        : "";
      return res.status(200).json({ message: `Timed out for ${session} session${noteMsg}`, record });
    }

    return res.status(400).json({ error: "Invalid actionType. Use 'timein' or 'timeout'." });
  } catch (err) {
    console.error("❌ CREATE attendance error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// ==============================
// GET ATTENDANCE
// ==============================
const getAttendance = async (req, res) => {
  try {
    const { userId, date, eventId } = req.query;
    const filter = {};

    if (date && date !== "all") filter.date = date;
    if (eventId) filter.eventId = eventId;

    if (userId) {
      const isObjectId = /^[a-f\d]{24}$/i.test(userId);
      if (isObjectId) {
        filter.studentId = userId;
      } else {
        const student = await User.findOne({ idNumber: userId }).select("_id").lean();
        if (student) filter.studentId = student._id;
        else return res.status(200).json([]);
      }
    }

    const records = await Attendance.find(filter)
      .populate("studentId", "firstName lastName idNumber course yearLevel section photoURL")
      .populate("sscId", "firstName lastName email")
      .populate("eventId", "title startDate endDate morningAttendance afternoonAttendance location participationType families fines")
      .sort({ createdAt: 1 })
      .lean();

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
    const { eventId, session, tab, yearLevel, family, date } = req.body;
    console.log("🔴 AUTO MARK ABSENT:", { eventId, session, tab, yearLevel, family, date });

    if (!eventId) return res.status(400).json({ error: "Event ID required" });
    if (!session || !["morning", "afternoon"].includes(session))
      return res.status(400).json({ error: "Valid session required (morning/afternoon)" });
    if (!tab) return res.status(400).json({ error: "Tab selection required" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const targetDate = date || getPHTDateString();
    console.log(`🔴 Marking absent for event: ${event.title}, date: ${targetDate}, session: ${session}`);

    const allStudents = await User.find({ role: "student" }).select("_id firstName lastName yearLevel course section").lean();
    const filteredStudents = filterStudentsByTab(allStudents, tab, yearLevel, family, event);

    if (filteredStudents.length === 0) {
      return res.status(200).json({ message: "No students found for this selection", count: 0, totalStudents: 0 });
    }

    const existingRecords = await Attendance.find({ eventId, date: targetDate }).lean();
    const recordMap = new Map(existingRecords.map(r => [r.studentId.toString(), r]));

    const bulkOps = [];
    let totalMarked = 0;

    for (const student of filteredStudents) {
      const key      = student._id.toString();
      const existing = recordMap.get(key);

      if (!existing) {
        bulkOps.push({
          insertOne: {
            document: {
              studentId: student._id, sscId: null, eventId,
              date: targetDate, morningStatus: "absent", afternoonStatus: "absent",
            },
          },
        });
        totalMarked++;
      } else {
        const shouldUpdate =
          (session === "morning"   && !existing.morningIn) ||
          (session === "afternoon" && !existing.afternoonIn);

        if (shouldUpdate) {
          bulkOps.push({
            updateOne: {
              filter: { _id: existing._id },
              update: { $set: { [`${session}Status`]: "absent" } },
            },
          });
          totalMarked++;
        }
      }
    }

    if (bulkOps.length > 0) await Attendance.bulkWrite(bulkOps);

    const message = totalMarked > 0
      ? `${totalMarked} student(s) marked absent for ${session} session on ${targetDate}`
      : `All students already have ${session} attendance records for ${targetDate}`;

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
    const validStatuses = ["present", "late", "absent"];

    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ error: "Attendance not found" });

    if (morningStatus   && validStatuses.includes(morningStatus))   record.morningStatus   = morningStatus;
    if (afternoonStatus && validStatuses.includes(afternoonStatus)) record.afternoonStatus = afternoonStatus;

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
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: "Attendance not found" });
    res.status(200).json({ message: "Attendance deleted" });
  } catch (err) {
    console.error("❌ DELETE attendance error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ==============================
// DELETE ALL ATTENDANCE FOR AN EVENT (cascade helper — not an HTTP route)
// ==============================
const deleteAttendanceByEvent = async (eventId) => {
  try {
    const result = await Attendance.deleteMany({ eventId });
    console.log(`🗑️ Cascade deleted ${result.deletedCount} attendance records for event ${eventId}`);
    return result.deletedCount;
  } catch (err) {
    console.error("❌ Cascade delete error:", err);
    throw err;
  }
};

// ==============================
// EXPORT ATTENDANCE TO EXCEL
//
// Exports EXACTLY what is visible on the active screen tab.
// - Base is the attendance RECORDS for the exact date + session + eventId.
// - Records are filtered by the active tab (college/seniorHigh/family)
//   and any active dropdowns (course, yearLevel, section, strand, family).
// - If no records match the filters → 404 (nothing to export).
// - Students with NO record on this date DO NOT appear — mirrors the screen.
// ==============================
const exportAttendance = async (req, res) => {
  try {
    const { eventId, tab, yearLevel, course, section, family, date, session } = req.query;

    if (!eventId)  return res.status(400).json({ error: "Event ID required" });
    if (!tab)      return res.status(400).json({ error: "Tab selection required" });
    if (!date)     return res.status(400).json({ error: "Date required" });
    if (!session || !["morning", "afternoon"].includes(session))
      return res.status(400).json({ error: "Session required (morning/afternoon)" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const totalFinePerDay = parseFloat(event.fines) || 0;
    const finePerSession  = totalFinePerDay > 0 ? totalFinePerDay / 2 : 0;
    const hasFines        = finePerSession > 0;

    // ── Step 1: Fetch attendance records for this exact date only ──────────
    // Base = records. Same source as what the screen shows.
    const attendanceRecords = await Attendance.find({ eventId, date })
      .populate("studentId", "firstName lastName idNumber course yearLevel section photoURL")
      .lean();

    // ── Step 2: Filter records by active tab + dropdowns ──────────────────
    // Mirrors the exact filteredRecords logic in the frontend useMemo.
    const filteredRecords = attendanceRecords.filter(r => {
      const s = r.studentId;
      if (!s) return false;
      const yl          = parseInt(s.yearLevel) || 0;
      const isFamily    = s.course?.toLowerCase().includes("family");
      const courseUpper = (s.course || "").toUpperCase();

      if (tab === "family") {
        if (!isFamily) return false;
        if (event.participationType === "FAMILY" && event.families?.length > 0) {
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

    // If nothing matches → nothing to export (mirrors screen showing 0 records)
    if (filteredRecords.length === 0) {
      return res.status(404).json({
        error: "No attendance records found for the current view. Nothing to export.",
      });
    }

    // ── Step 3: Build Excel ────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AttendSure";
    workbook.created = new Date();

    const sheetName = `${session.charAt(0).toUpperCase() + session.slice(1)} — ${date}`;
    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });

    const columns = [
      { header: "No.",        key: "no",       width: 6  },
      { header: "Student ID", key: "idNumber",  width: 14 },
      { header: "Name",       key: "name",      width: 28 },
      { header: "Course",     key: "course",    width: 14 },
      { header: "Year",       key: "year",      width: 10 },
      { header: "Section",    key: "section",   width: 10 },
      { header: "Status",     key: "status",    width: 12 },
      { header: "Time In",    key: "timeIn",    width: 16 },
      { header: "Time Out",   key: "timeOut",   width: 16 },
      { header: "Notes",      key: "notes",     width: 28 },
    ];
    if (hasFines) columns.push({ header: `Fine (₱${finePerSession})`, key: "fine", width: 14 });
    sheet.columns = columns;

    // Header row style
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

    // Style helpers
    const statusFill = s =>
      s === "PRESENT" ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } } :
      s === "LATE"    ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } :
                        { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };

    const statusColor = s =>
      s === "PRESENT" ? { argb: "FF065F46" } :
      s === "LATE"    ? { argb: "FF92400E" } :
                        { argb: "FF991B1B" };

    const applyBaseStyle = (row, isEven) => {
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
        // Zebra stripe — skip status col (7) and fine col
        const statusColIdx = 7;
        const fineColIdx   = hasFines ? 11 : -1;
        if (isEven && colNum !== statusColIdx && colNum !== fineColIdx) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      });
    };

    // ── Write rows ─────────────────────────────────────────────────────────
    let totalAbsentFines = 0;
    let presentCount = 0, lateCount = 0, absentCount = 0;

    filteredRecords.forEach((record, idx) => {
      const student = record.studentId;
      const yl = parseInt(student.yearLevel) || 0;
      const suffix   = student.yearLevel === "1" ? "st" : student.yearLevel === "2" ? "nd" : student.yearLevel === "3" ? "rd" : "th";
      const yearLabel =
        yl >= 11 && yl <= 12 ? `Grade ${yl}` :
        yl >= 1  && yl <= 4  ? `${student.yearLevel}${suffix} Year` :
        student.yearLevel || "—";

      const rawStatus = (session === "morning"
        ? record.morningStatus
        : record.afternoonStatus) || "absent";
      const status  = rawStatus.toUpperCase();
      const timeIn  = (session === "morning" ? record.morningIn    : record.afternoonIn)    || "—";
      const timeOut = (session === "morning" ? record.morningOut   : record.afternoonOut)   || "—";
      const notes   = (session === "morning" ? record.morningNote  : record.afternoonNote)  || "—";
      const fine    = hasFines && status === "ABSENT" ? finePerSession : 0;

      if (status === "PRESENT") presentCount++;
      else if (status === "LATE") lateCount++;
      else absentCount++;
      totalAbsentFines += fine;

      const rowData = {
        no:       idx + 1,
        idNumber: student.idNumber || "",
        name:     `${student.firstName} ${student.lastName}`,
        course:   student.course || "",
        year:     yearLabel,
        section:  student.section || "—",
        status,
        timeIn,
        timeOut,
        notes,
      };
      if (hasFines) rowData.fine = fine > 0 ? `₱${fine.toFixed(2)}` : "—";

      const row = sheet.addRow(rowData);
      applyBaseStyle(row, idx % 2 !== 0);

      const statusCell = row.getCell("status");
      statusCell.fill = statusFill(status);
      statusCell.font = { name: "Arial", size: 10, bold: true, color: statusColor(status) };

      if (hasFines) {
        const fineCell = row.getCell("fine");
        if (fine > 0) {
          fineCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
          fineCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF9A3412" } };
        } else {
          fineCell.font = { name: "Arial", size: 10, color: { argb: "FF94A3B8" } };
        }
      }
    });

    // ── Summary row ────────────────────────────────────────────────────────
    sheet.addRow({}); // spacer

    const summaryData = {
      no:       "",
      idNumber: "SUMMARY",
      name:     `${filteredRecords.length} record(s)  •  Present: ${presentCount}  |  Late: ${lateCount}  |  Absent: ${absentCount}`,
      course:   "",
      year:     "",
      section:  "",
      status:   "",
      timeIn:   "",
      timeOut:  "",
      notes:    hasFines ? "Total fines" : "",
    };
    if (hasFines) summaryData.fine = `₱${totalAbsentFines.toFixed(2)}`;

    const summaryRow = sheet.addRow(summaryData);
    summaryRow.height = 28;
    summaryRow.eachCell({ includeEmpty: true }, cell => {
      cell.font      = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // ── Filename ───────────────────────────────────────────────────────────
    const formattedDate = new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).replace(/,/g, "").replace(/ /g, "-");
    let filename = `attendance_${event.title.replace(/\s+/g, "_")}`;

    if (tab === "family") {
      filename += `_Family${family && family !== "all" ? `_${family}` : ""}`;
    } else if (tab === "seniorHigh") {
      filename += "_SeniorHigh";
      if (course    && course    !== "all") filename += `_${course.replace(/\s/g, "")}`;
      if (yearLevel && yearLevel !== "all") filename += `_Grade${yearLevel}`;
      if (section   && section   !== "all") filename += `_Sec${section}`;
    } else {
      filename += "_College";
      if (course    && course    !== "all") filename += `_${course}`;
      if (yearLevel && yearLevel !== "all") filename += `_Year${yearLevel}`;
      if (section   && section   !== "all") filename += `_Sec${section}`;
    }
    filename += `_${formattedDate}_${session}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length",      buffer.length);
    res.status(200).end(buffer);

    console.log(`✅ Export done: ${buffer.length} bytes | ${filteredRecords.length} records | date=${date} | session=${session} | present=${presentCount} late=${lateCount} absent=${absentCount}`);
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