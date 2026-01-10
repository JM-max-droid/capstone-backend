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
      
      // Filter by event's families array
      if (event.participationType === "FAMILY" && event.families && event.families.length > 0) {
        const familyNum = s.course?.match(/\d+/)?.[0];
        if (!familyNum || !event.families.includes(parseInt(familyNum))) return false;
      }
      
      // If specific family selected
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

    // History or other tabs
    return true;
  });
};

// ============================== 
// ✅ HELPER: Parse time string with robust error handling
// ============================== 
const parseTime = (timeStr) => {
  try {
    if (!timeStr || typeof timeStr !== 'string') {
      console.log("⚠️ Invalid time input:", timeStr);
      return null;
    }

    // Remove AM/PM and trim
    const cleanTime = timeStr.replace(/\s*(AM|PM|am|pm)\s*$/i, '').trim();
    
    // Check if format is valid (HH:MM)
    if (!/^\d{1,2}:\d{2}$/.test(cleanTime)) {
      console.log("⚠️ Invalid time format:", timeStr);
      return null;
    }

    const parts = cleanTime.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    // Validate ranges
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.log("⚠️ Time out of range:", timeStr, { hours, minutes });
      return null;
    }

    let finalHours = hours;
    const finalMinutes = minutes;
    
    // Handle PM (1 PM = 13:00, 2 PM = 14:00, etc.)
    if (/PM/i.test(timeStr) && hours !== 12) {
      finalHours = hours + 12;
    }
    
    // Handle 12 AM (midnight = 00:00)
    if (/AM/i.test(timeStr) && hours === 12) {
      finalHours = 0;
    }
    
    // Final validation
    if (finalHours < 0 || finalHours > 23) {
      console.log("⚠️ Converted time out of range:", { original: timeStr, finalHours, finalMinutes });
      return null;
    }

    return { hours: finalHours, minutes: finalMinutes };
  } catch (err) {
    console.error("❌ Error parsing time:", timeStr, err);
    return null;
  }
};

// ============================== 
// ✅ HELPER: Determine session and status
// ============================== 
const getSessionAndStatus = (event) => {
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    console.log(`🕐 Current time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} (${currentMinutes} min)`);

    // ✅ Check MORNING TIME IN
    if (event.morningAttendance?.start && event.morningAttendance?.end) {
      const start = parseTime(event.morningAttendance.start);
      const end = parseTime(event.morningAttendance.end);
      
      if (start && end) {
        const startMin = start.hours * 60 + start.minutes;
        const endMin = end.hours * 60 + end.minutes;
        const allotted = event.morningAttendance.allottedTime || 30;
        const lateLimit = endMin + allotted;

        console.log(`📅 Morning IN: ${event.morningAttendance.start}-${event.morningAttendance.end} (${startMin}-${endMin} min), Grace: ${allotted} min`);

        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          console.log("✅ PRESENT - Within morning session");
          return { session: "morning", status: "present", type: "in" };
        }

        if (currentMinutes > endMin && currentMinutes <= lateLimit) {
          console.log("⚠️ LATE - Within morning grace period");
          return { session: "morning", status: "late", type: "in" };
        }
      }
    }

    // ✅ Check MORNING TIME OUT
    if (event.morningAttendance?.timeout) {
      const timeout = parseTime(event.morningAttendance.timeout);
      if (timeout) {
        const timeoutMin = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd = timeoutMin + 30;

        console.log(`📅 Morning OUT: ${event.morningAttendance.timeout} (${timeoutMin} min)`);

        if (currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd) {
          console.log("✅ Morning TIME OUT window");
          return { session: "morning", status: "present", type: "out" };
        }
      }
    }

    // ✅ Check AFTERNOON TIME IN
    if (event.afternoonAttendance?.start && event.afternoonAttendance?.end) {
      const start = parseTime(event.afternoonAttendance.start);
      const end = parseTime(event.afternoonAttendance.end);
      
      if (start && end) {
        const startMin = start.hours * 60 + start.minutes;
        const endMin = end.hours * 60 + end.minutes;
        const allotted = event.afternoonAttendance.allottedTime || 30;
        const lateLimit = endMin + allotted;

        console.log(`📅 Afternoon IN: ${event.afternoonAttendance.start}-${event.afternoonAttendance.end} (${startMin}-${endMin} min), Grace: ${allotted} min`);

        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          console.log("✅ PRESENT - Within afternoon session");
          return { session: "afternoon", status: "present", type: "in" };
        }

        if (currentMinutes > endMin && currentMinutes <= lateLimit) {
          console.log("⚠️ LATE - Within afternoon grace period");
          return { session: "afternoon", status: "late", type: "in" };
        }
      }
    }

    // ✅ Check AFTERNOON TIME OUT
    if (event.afternoonAttendance?.timeout) {
      const timeout = parseTime(event.afternoonAttendance.timeout);
      if (timeout) {
        const timeoutMin = timeout.hours * 60 + timeout.minutes;
        const timeoutEnd = timeoutMin + 30;

        console.log(`📅 Afternoon OUT: ${event.afternoonAttendance.timeout} (${timeoutMin} min)`);

        if (currentMinutes >= timeoutMin && currentMinutes <= timeoutEnd) {
          console.log("✅ Afternoon TIME OUT window");
          return { session: "afternoon", status: "present", type: "out" };
        }
      }
    }

    console.log("❌ No active session available");
    return null;
  } catch (err) {
    console.error("❌ Error in getSessionAndStatus:", err);
    return null;
  }
};

// ============================== 
// CREATE ATTENDANCE
// ============================== 
const createAttendance = async (req, res) => {
  try {
    const { studentId, sscId, eventId, role } = req.body;

    console.log("📝 Attendance request:", { studentId, sscId, eventId, role });

    if (role !== "ssc") {
      return res.status(403).json({ error: "Access denied. SSC only." });
    }

    if (!studentId || !sscId || !eventId) {
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

    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date().toLocaleTimeString("en-US", { 
      hour12: true, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });

    const sessionInfo = getSessionAndStatus(event);
    if (!sessionInfo) {
      return res.status(400).json({ 
        error: "Cannot scan now. No active time-in or time-out window available." 
      });
    }

    const { session, status, type } = sessionInfo;
    
    console.log(`✅ Determined: Session=${session}, Status=${status}, Type=${type}`);

    let record = await Attendance.findOne({
      studentId,
      eventId,
      date: today,
    });

    if (!record) {
      record = new Attendance({
        studentId,
        sscId,
        eventId,
        date: today,
        morningStatus: "absent",
        afternoonStatus: "absent",
      });
    }

    if (type === "in") {
      if (session === "morning") {
        if (record.morningIn) {
          return res.status(409).json({ 
            error: "Already timed in for morning session" 
          });
        }
        record.morningIn = currentTime;
        record.morningStatus = status;
      } else {
        if (record.afternoonIn) {
          return res.status(409).json({ 
            error: "Already timed in for afternoon session" 
          });
        }
        record.afternoonIn = currentTime;
        record.afternoonStatus = status;
      }

      await record.save();

      console.log(`✅ TIME IN: ${student.firstName} ${student.lastName} - ${session} - ${status}`);
      
      return res.status(201).json({
        message: `Timed IN as ${status.toUpperCase()} for ${session} session`,
        record,
      });

    } else {
      if (session === "morning") {
        if (!record.morningIn) {
          return res.status(400).json({ 
            error: "Cannot time out. No morning time-in record found. Please time in first." 
          });
        }
        if (record.morningOut) {
          return res.status(409).json({ 
            error: "Already timed out for morning session" 
          });
        }
        record.morningOut = currentTime;
      } else {
        if (!record.afternoonIn) {
          return res.status(400).json({ 
            error: "Cannot time out. No afternoon time-in record found. Please time in first." 
          });
        }
        if (record.afternoonOut) {
          return res.status(409).json({ 
            error: "Already timed out for afternoon session" 
          });
        }
        record.afternoonOut = currentTime;
      }

      await record.save();

      console.log(`✅ TIME OUT: ${student.firstName} ${student.lastName} - ${session}`);

      return res.status(200).json({
        message: `Timed OUT for ${session} session`,
        record,
      });
    }

  } catch (err) {
    console.error("❌ CREATE attendance error:", err);
    res.status(500).json({ error: "Server error" });
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
// ✅ AUTO MARK ABSENT (FIXED - No Race Condition)
// ============================== 
const autoMarkAbsent = async (req, res) => {
  try {
    const { eventId, session, tab, yearLevel, family } = req.body;

    console.log("🔴 AUTO MARK ABSENT REQUEST:", { eventId, session, tab, yearLevel, family });

    // ✅ Validation
    if (!eventId) return res.status(400).json({ error: "Event ID required" });
    if (!session || !["morning", "afternoon"].includes(session)) {
      return res.status(400).json({ error: "Valid session required (morning/afternoon)" });
    }
    if (!tab) return res.status(400).json({ error: "Tab selection required" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const today = new Date().toISOString().split("T")[0];
    console.log(`🔴 Auto-marking ${session} absent for event: ${event.title}, Date: ${today}`);

    // ✅ Get all students
    let allStudents = await User.find({ role: "student" })
      .select("_id firstName lastName yearLevel course")
      .lean();
    
    console.log(`👥 Total students in database: ${allStudents.length}`);

    // ✅ Filter students based on tab and criteria
    const filteredStudents = filterStudentsByTab(allStudents, tab, yearLevel, family, event);
    
    console.log(`📋 Filtered students for tab '${tab}': ${filteredStudents.length}`);

    // ✅ CHECK: If no students match the filter, return error with helpful message
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

    // ✅ Get existing records
    const existingRecords = await Attendance.find({ eventId, date: today }).lean();
    const recordMap = new Map();
    existingRecords.forEach(r => recordMap.set(r.studentId.toString(), r));

    console.log(`📊 Existing attendance records: ${existingRecords.length}`);

    // ✅ Prepare bulk operations to avoid race conditions
    const bulkOps = [];
    let totalMarked = 0;

    for (const student of filteredStudents) {
      const studentIdStr = student._id.toString();
      const existingRecord = recordMap.get(studentIdStr);

      if (!existingRecord) {
        // Create new record with absent status
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
        // Update existing record ONLY if they haven't timed in
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

    // ✅ Execute bulk operations (atomic, no race conditions)
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
// ✅ EXPORT ATTENDANCE TO EXCEL (FIXED VERSION)
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

    // ✅ Get date range from event
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const dates = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split("T")[0]);
    }

    console.log(`📅 Date range: ${dates.join(", ")}`);

    // ✅ Get all students
    let allStudents = await User.find({ role: "student" })
      .select("firstName lastName idNumber course yearLevel section")
      .lean();

    console.log(`👥 Total students: ${allStudents.length}`);

    // ✅ Filter by tab and year level using the helper function
    const filteredStudents = filterStudentsByTab(allStudents, tab, yearLevel, family, event);

    console.log(`📊 Filtered students for export: ${filteredStudents.length}`);

    // ✅ CHECK: If no students match the filter, return helpful error
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

    // ✅ Get all attendance records
    const records = await Attendance.find({ eventId })
      .populate("studentId")
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    // ✅ Setup columns
    sheet.columns = [
      { header: "No.", key: "no", width: 6 },
      { header: "Student ID", key: "id", width: 15 },
      { header: "Name", key: "name", width: 25 },
      { header: "Course", key: "course", width: 20 },
      { header: "Year", key: "year", width: 8 },
      { header: "Section", key: "section", width: 12 },
      { header: "Date", key: "date", width: 15 },
      { header: "Session", key: "session", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Time In", key: "timeIn", width: 15 },
      { header: "Time Out", key: "timeOut", width: 15 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B84FF' }
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // ✅ Add data rows
    let rowNum = 1;
    
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

        // Morning row
        sheet.addRow({
          no: rowNum,
          id: student.idNumber,
          name: `${student.firstName} ${student.lastName}`,
          course: student.course,
          year: student.yearLevel,
          section: student.section || "",
          date: formattedDate,
          session: "Morning",
          status: record?.morningStatus ? record.morningStatus.toUpperCase() : "ABSENT",
          timeIn: record?.morningIn || "—",
          timeOut: record?.morningOut || "—",
        });

        // Afternoon row
        sheet.addRow({
          no: "",
          id: "",
          name: "",
          course: "",
          year: "",
          section: "",
          date: "",
          session: "Afternoon",
          status: record?.afternoonStatus ? record.afternoonStatus.toUpperCase() : "ABSENT",
          timeIn: record?.afternoonIn || "—",
          timeOut: record?.afternoonOut || "—",
        });
      });
      
      rowNum++;
    });

    // ✅ Generate filename based on tab
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