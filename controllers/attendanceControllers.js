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
// ✅ FIXED: Parse time string - handles "8:03 AM" format reliably
// ============================== 
const parseTime = (timeStr) => {
  try {
    if (!timeStr || typeof timeStr !== 'string') {
      console.log("⚠️ Invalid time input:", timeStr);
      return null;
    }

    // ✅ Use regex to match "8:03 AM", "08:03 AM", "8:03 PM", "08:03 PM"
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
// ✅ FIXED: Get PHT (UTC+8) current minutes
// Render servers run UTC — must offset manually
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
// ✅ FIXED: Get PHT date string (YYYY-MM-DD)
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
// ✅ FIXED: Get PHT time string for storing in DB
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
// ✅ FIXED: Get session info with proper timeout windows
// ============================== 
const getSessionInfo = (event) => {
  try {
    // ✅ Use PHT time instead of server local time
    const currentMinutes = getPHTMinutes();
    
    console.log(`🕐 Current PHT minutes: ${currentMinutes}`);

    const sessions = [];

    // ✅ MORNING TIME IN
    if (event.morningAttendance?.start && event.morningAttendance?.end) {
      const start = parseTime(event.morningAttendance.start);
      const end = parseTime(event.morningAttendance.end);
      
      if (start && end) {
        const startMin = start.hours * 60 + start.minutes;
        const endMin = end.hours * 60 + end.minutes;
        const allotted = event.morningAttendance.allottedTime || 30;
        const lateLimit = endMin + allotted;

        console.log(`🔍 Morning IN window: ${startMin}-${endMin} min, late until: ${lateLimit} min`);

        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          console.log(`✅ MORNING TIME-IN ACTIVE (Present)`);
          sessions.push({ session: "morning", type: "in", status: "present", isLate: false });
        } else if (currentMinutes > endMin && currentMinutes <= lateLimit) {
          console.log(`✅ MORNING TIME-IN ACTIVE (Late)`);
          sessions.push({ session: "morning", type: "in", status: "late", isLate: true });
        }
      }
    }

    // ✅ MORNING TIME OUT - FIXED WITH PROPER WINDOW
    if (event.morningAttendance?.timeout) {
      console.log(`🔍 Checking morning timeout: ${event.morningAttendance.timeout}`);
      const timeout = parseTime(event.morningAttendance.timeout);
      
      if (timeout) {
        const timeoutMin = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd = timeoutMin + 60; // 1 hour window

        console.log(`🔍 Morning OUT window: ${timeoutMin}-${timeoutEnd} min`);
        console.log(`🔍 Current: ${currentMinutes} min`);
        console.log(`🔍 Is in window? ${currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd}`);

        if (currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd) {
          console.log(`✅ MORNING TIME-OUT ACTIVE!`);
          sessions.push({ session: "morning", type: "out", status: "present", isLate: false });
        } else {
          console.log(`❌ Morning timeout not active (current: ${currentMinutes}, window: ${timeoutMin}-${timeoutEnd})`);
        }
      } else {
        console.log(`❌ Failed to parse morning timeout: ${event.morningAttendance.timeout}`);
      }
    }

    // ✅ AFTERNOON TIME IN
    if (event.afternoonAttendance?.start && event.afternoonAttendance?.end) {
      const start = parseTime(event.afternoonAttendance.start);
      const end = parseTime(event.afternoonAttendance.end);
      
      if (start && end) {
        const startMin = start.hours * 60 + start.minutes;
        let endMin = end.hours * 60 + end.minutes;

        // ✅ Handle overnight sessions (e.g. 8:03 PM - 2:08 AM)
        if (endMin < startMin) endMin += 24 * 60;

        const allotted = event.afternoonAttendance.allottedTime || 30;
        const lateLimit = endMin + allotted;

        // Normalize current for overnight comparison
        let currMin = currentMinutes;
        if (currMin < startMin && startMin > 12 * 60) currMin += 24 * 60;

        console.log(`🔍 Afternoon IN window: ${startMin}-${endMin} min, late until: ${lateLimit} min`);

        if (currMin >= startMin && currMin <= endMin) {
          console.log(`✅ AFTERNOON TIME-IN ACTIVE (Present)`);
          sessions.push({ session: "afternoon", type: "in", status: "present", isLate: false });
        } else if (currMin > endMin && currMin <= lateLimit) {
          console.log(`✅ AFTERNOON TIME-IN ACTIVE (Late)`);
          sessions.push({ session: "afternoon", type: "in", status: "late", isLate: true });
        }
      }
    }

    // ✅ AFTERNOON TIME OUT - FIXED WITH PROPER WINDOW
    if (event.afternoonAttendance?.timeout) {
      console.log(`🔍 Checking afternoon timeout: ${event.afternoonAttendance.timeout}`);
      const timeout = parseTime(event.afternoonAttendance.timeout);
      
      if (timeout) {
        const timeoutMin = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd = timeoutMin + 60; // 1 hour window
        
        console.log(`🔍 Afternoon OUT window: ${timeoutMin}-${timeoutEnd} min`);
        console.log(`🔍 Current: ${currentMinutes} min`);
        console.log(`🔍 Is in window? ${currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd}`);

        if (currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd) {
          console.log(`✅ AFTERNOON TIME-OUT ACTIVE!`);
          sessions.push({ session: "afternoon", type: "out", status: "present", isLate: false });
        } else {
          console.log(`❌ Afternoon timeout not active (current: ${currentMinutes}, window: ${timeoutMin}-${timeoutEnd})`);
        }
      } else {
        console.log(`❌ Failed to parse afternoon timeout: ${event.afternoonAttendance.timeout}`);
      }
    }

    console.log(`✅ Found ${sessions.length} active sessions:`, sessions.map(s => `${s.session} ${s.type}`).join(", "));
    return sessions;
  } catch (err) {
    console.error("❌ Error in getSessionInfo:", err);
    return [];
  }
};

// ============================== 
// ✅ FIXED: CREATE ATTENDANCE with proper timeout handling
// ============================== 
const createAttendance = async (req, res) => {
  try {
    const { studentId, sscId, eventId, role, actionType } = req.body;

    console.log("📝 Attendance request:", { studentId, sscId, eventId, role, actionType });

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

    // ✅ Use PHT for date and time
    const today = getPHTDateString();
    const currentTime = getPHTTimeString();

    console.log(`⏰ PHT time: ${currentTime}, date: ${today}`);

    const sessions = getSessionInfo(event);
    
    if (sessions.length === 0) {
      return res.status(400).json({ 
        error: "No active session available at this time." 
      });
    }

    console.log(`📋 Active sessions:`, sessions);

    // Find existing record
    let record = await Attendance.findOne({
      studentId,
      eventId,
      date: today,
    });

    // ✅ TIME IN
    if (actionType === "timein") {
      const timeInSession = sessions.find(s => s.type === "in");
      
      if (!timeInSession) {
        return res.status(400).json({ 
          error: "No active time-in window available at this time." 
        });
      }

      const { session, status } = timeInSession;

      // Create record if doesn't exist
      if (!record) {
        record = new Attendance({
          studentId,
          sscId,
          eventId,
          date: today,
          morningStatus: "absent",
          afternoonStatus: "absent",
        });
        console.log(`📝 Creating new attendance record`);
      }

      // Check if already timed in
      if (session === "morning") {
        if (record.morningIn) {
          return res.status(409).json({ 
            error: `Already timed in for morning session at ${record.morningIn}. Status: ${record.morningStatus.toUpperCase()}`
          });
        }
        record.morningIn = currentTime;
        record.morningStatus = status;
        console.log(`✅ Morning time-in recorded: ${status}`);
      } else {
        if (record.afternoonIn) {
          return res.status(409).json({ 
            error: `Already timed in for afternoon session at ${record.afternoonIn}. Status: ${record.afternoonStatus.toUpperCase()}`
          });
        }
        record.afternoonIn = currentTime;
        record.afternoonStatus = status;
        console.log(`✅ Afternoon time-in recorded: ${status}`);
      }

      await record.save();

      console.log(`✅ TIME IN SUCCESS: ${student.firstName} ${student.lastName} - ${session} - ${status}`);
      
      return res.status(201).json({
        message: `Successfully timed in as ${status.toUpperCase()} for ${session} session`,
        record,
      });
    }

    // ✅ TIME OUT - FIXED
    if (actionType === "timeout") {
      console.log(`🔍 Processing timeout request...`);
      
      const timeOutSession = sessions.find(s => s.type === "out");
      
      if (!timeOutSession) {
        console.log(`❌ No active timeout session found`);
        console.log(`📋 Available sessions:`, sessions);
        return res.status(400).json({ 
          error: "No active time-out window available at this time. Timeout window is 1 hour from scheduled time."
        });
      }

      const { session } = timeOutSession;
      console.log(`✅ Found timeout session: ${session}`);

      // Check if record exists
      if (!record) {
        console.log(`❌ No attendance record found`);
        return res.status(400).json({ 
          error: `Cannot time out. No attendance record found. Please time in first.`
        });
      }

      // Validate based on session
      if (session === "morning") {
        console.log(`🔍 Checking morning timeout...`);
        console.log(`   - morningIn: ${record.morningIn}`);
        console.log(`   - morningOut: ${record.morningOut}`);
        
        if (!record.morningIn) {
          return res.status(400).json({ 
            error: "Cannot time out for morning session. You haven't timed in yet. Please time in first."
          });
        }
        if (record.morningOut) {
          return res.status(409).json({ 
            error: `Already timed out for morning session at ${record.morningOut}`
          });
        }
        
        record.morningOut = currentTime;
        console.log(`✅ Morning timeout recorded: ${currentTime}`);
        
      } else { // afternoon
        console.log(`🔍 Checking afternoon timeout...`);
        console.log(`   - afternoonIn: ${record.afternoonIn}`);
        console.log(`   - afternoonOut: ${record.afternoonOut}`);
        
        if (!record.afternoonIn) {
          return res.status(400).json({ 
            error: "Cannot time out for afternoon session. You haven't timed in yet. Please time in first."
          });
        }
        if (record.afternoonOut) {
          return res.status(409).json({ 
            error: `Already timed out for afternoon session at ${record.afternoonOut}`
          });
        }
        
        record.afternoonOut = currentTime;
        console.log(`✅ Afternoon timeout recorded: ${currentTime}`);
      }

      await record.save();

      console.log(`✅ TIME OUT SUCCESS: ${student.firstName} ${student.lastName} - ${session}`);

      return res.status(200).json({
        message: `Successfully timed out for ${session} session`,
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
// GET ATTENDANCE
// ============================== 
const getAttendance = async (req, res) => {
  try {
    const { role, userId, date, eventId } = req.query;
    const filter = {};

    if (date) filter.date = date;
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

    // ✅ Use PHT date
    const today = getPHTDateString();
    console.log(`🔴 Auto-marking ${session} absent for event: ${event.title}, Date: ${today}`);

    let allStudents = await User.find({ role: "student" })
      .select("_id firstName lastName yearLevel course")
      .lean();
    
    console.log(`👥 Total students in database: ${allStudents.length}`);

    const filteredStudents = filterStudentsByTab(allStudents, tab, yearLevel, family, event);
    
    console.log(`📋 Filtered students for tab '${tab}': ${filteredStudents.length}`);

    if (filteredStudents.length === 0) {
      let message = "No students found for this selection";
      
      if (tab === "college" && yearLevel && yearLevel !== "all") {
        const yearName = yearLevel === "1" ? "1st" : yearLevel === "2" ? "2nd" : yearLevel === "3" ? "3rd" : "4th";
        message = `No ${yearName} year college students found`;
      } else if (tab === "seniorHigh" && yearLevel && yearLevel !== "all") {
        message = `No Grade ${yearLevel} students found`;
      } else if (tab === "family" && family && family !== "all") {
        message = `No Family ${family} members found`;
      } else if (tab === "family") {
        if (event.participationType === "FAMILY" && event.families && event.families.length > 0) {
          message = `No family members found for families: ${event.families.join(", ")}`;
        } else {
          message = "No family members found for this event";
        }
      } else if (tab === "seniorHigh") {
        message = "No senior high students (Grade 11-12) found";
      } else if (tab === "college") {
        message = "No college students (Year 1-4) found";
      }

      console.log(`⚠️ ${message}`);
      return res.status(200).json({ 
        message,
        count: 0,
        totalStudents: 0,
        warning: "No students match the current filter criteria"
      });
    }

    const existingRecords = await Attendance.find({ eventId, date: today }).lean();
    const recordMap = new Map();
    existingRecords.forEach(r => recordMap.set(r.studentId.toString(), r));

    console.log(`📊 Existing attendance records: ${existingRecords.length}`);

    const bulkOps = [];
    let totalMarked = 0;

    for (const student of filteredStudents) {
      const studentIdStr = student._id.toString();
      const existingRecord = recordMap.get(studentIdStr);

      if (!existingRecord) {
        bulkOps.push({
          insertOne: {
            document: {
              studentId: student._id,
              sscId: null,
              eventId,
              date: today,
              morningStatus: "absent",
              afternoonStatus: "absent",
            }
          }
        });
        totalMarked++;
        console.log(`➕ Will create new record for: ${student.firstName} ${student.lastName}`);
      } else {
        let shouldUpdate = false;
        const updateFields = {};

        if (session === "morning" && !existingRecord.morningIn) {
          updateFields.morningStatus = "absent";
          shouldUpdate = true;
          totalMarked++;
          console.log(`✏️ Will mark morning absent for: ${student.firstName} ${student.lastName}`);
        } else if (session === "afternoon" && !existingRecord.afternoonIn) {
          updateFields.afternoonStatus = "absent";
          shouldUpdate = true;
          totalMarked++;
          console.log(`✏️ Will mark afternoon absent for: ${student.firstName} ${student.lastName}`);
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
      console.log(`✅ Bulk operation completed: ${bulkOps.length} operations`);
    }

    console.log(`✅ Total ${session} sessions marked absent: ${totalMarked}`);

    const message = totalMarked > 0
      ? `${totalMarked} student(s) marked absent for ${session} session`
      : `All students already have attendance records for ${session} session`;

    res.status(200).json({
      message,
      count: totalMarked,
      totalStudents: filteredStudents.length,
    });
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

    console.log(`✅ Attendance updated: ${populated.studentId.firstName} ${populated.studentId.lastName}`);

    res.status(200).json({ 
      message: "Attendance updated", 
      record: populated 
    });
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

    console.log(`✅ Attendance deleted: ${id}`);
    res.status(200).json({ message: "Attendance deleted" });
  } catch (err) {
    console.error("❌ DELETE attendance error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ============================== 
// ✅ FIXED: EXPORT ATTENDANCE TO EXCEL - MATCHES YOUR EXACT FORMAT
// ============================== 
const exportAttendance = async (req, res) => {
  try {
    const { eventId, tab, yearLevel, family } = req.query;

    console.log("📤 EXPORT REQUEST:", { eventId, tab, yearLevel, family });

    if (!eventId) {
      return res.status(400).json({ error: "Event ID required" });
    }

    if (!tab) {
      return res.status(400).json({ error: "Tab selection required" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const dates = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split("T")[0]);
    }

    console.log(`📅 Date range: ${dates.join(", ")}`);

    let allStudents = await User.find({ role: "student" })
      .select("firstName lastName idNumber course yearLevel section")
      .lean();

    console.log(`👥 Total students: ${allStudents.length}`);

    const filteredStudents = filterStudentsByTab(allStudents, tab, yearLevel, family, event);

    console.log(`📊 Filtered students for export: ${filteredStudents.length}`);

    if (filteredStudents.length === 0) {
      let message = "No students found to export";
      
      if (tab === "college" && yearLevel && yearLevel !== "all") {
        const yearName = yearLevel === "1" ? "1st" : yearLevel === "2" ? "2nd" : yearLevel === "3" ? "3rd" : "4th";
        message = `No ${yearName} year college students found to export`;
      } else if (tab === "seniorHigh" && yearLevel && yearLevel !== "all") {
        message = `No Grade ${yearLevel} students found to export`;
      } else if (tab === "family" && family && family !== "all") {
        message = `No Family ${family} members found to export`;
      } else if (tab === "family") {
        if (event.participationType === "FAMILY" && event.families && event.families.length > 0) {
          message = `No family members found for families: ${event.families.join(", ")}`;
        } else {
          message = "No family members found for this event";
        }
      } else if (tab === "seniorHigh") {
        message = "No senior high students (Grade 11-12) found to export";
      } else if (tab === "college") {
        message = "No college students (Year 1-4) found to export";
      }

      console.log(`⚠️ ${message}`);
      return res.status(404).json({ error: message });
    }

    const records = await Attendance.find({ eventId })
      .populate("studentId")
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    sheet.getRow(1).values = [
      "No.",
      "Student ID", 
      "Name",
      "Course",
      "Year",
      "Section",
      "Date",
      "Session",
      "",
      "Time In",
      "",
      "Time Out"
    ];

    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 10;
    sheet.getColumn(6).width = 10;
    sheet.getColumn(7).width = 15;
    sheet.getColumn(8).width = 12;
    sheet.getColumn(9).width = 2;
    sheet.getColumn(10).width = 15;
    sheet.getColumn(11).width = 2;
    sheet.getColumn(12).width = 15;

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B84FF' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let rowNum = 1;
    let currentRow = 2;
    
    filteredStudents.forEach((student) => {
      dates.forEach(date => {
        const formattedDate = new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });

        const record = records.find(
          r => r.studentId?._id?.toString() === student._id.toString() &&
               r.date === date
        );

        sheet.getRow(currentRow).values = [
          rowNum,
          student.idNumber,
          `${student.firstName} ${student.lastName}`,
          student.course,
          `${student.yearLevel}${student.yearLevel === "1" ? "st" : student.yearLevel === "2" ? "nd" : student.yearLevel === "3" ? "rd" : "th"} Year`,
          student.section || "B",
          formattedDate,
          record?.morningStatus ? record.morningStatus.toUpperCase() : "ABSENT",
          "",
          record?.morningIn || "—",
          "",
          record?.morningOut || "—"
        ];
        
        sheet.getRow(currentRow).alignment = { vertical: 'middle' };
        sheet.getRow(currentRow).font = { name: 'Arial' };
        currentRow++;

        sheet.getRow(currentRow).values = [
          "", "", "", "", "", "", "",
          record?.afternoonStatus ? record.afternoonStatus.toUpperCase() : "ABSENT",
          "",
          record?.afternoonIn || "—",
          "",
          record?.afternoonOut || "—"
        ];
        
        sheet.getRow(currentRow).alignment = { vertical: 'middle' };
        sheet.getRow(currentRow).font = { name: 'Arial' };
        currentRow++;
      });
      
      rowNum++;
    });

    let filename = `attendance_${event.title.replace(/\s+/g, '_')}`;
    if (tab === "family" && family && family !== "all") {
      filename += `_Family_${family}`;
    } else if (tab === "seniorHigh" && yearLevel && yearLevel !== "all") {
      filename += `_Grade_${yearLevel}`;
    } else if (tab === "college" && yearLevel && yearLevel !== "all") {
      filename += `_Year_${yearLevel}`;
    } else if (tab) {
      filename += `_${tab}`;
    }
    filename += ".xlsx";

    console.log(`✅ Generating Excel file: ${filename}`);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel export completed successfully`);

  } catch (err) {
    console.error("❌ EXPORT error:", err);
    res.status(500).json({ error: "Export failed: " + err.message });
  }
};

// ============================== 
// EXPORTS
// ============================== 
module.exports = {
  createAttendance,
  getAttendance,
  autoMarkAbsent,
  updateAttendance,
  deleteAttendance,
  exportAttendance,
};