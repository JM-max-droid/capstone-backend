const User = require("../models/User");
const AcademicYear = require("../models/academicYear");

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function getNextAcademicYear(current) {
  const [start, end] = current.split("-").map(Number);
  return `${start + 1}-${end + 1}`;
}

function getNextYearLevel(yearLevel, course, strand) {
  const y = yearLevel?.toLowerCase() || "";
  if (course && course.trim()) {
    if (y.includes("1st")) return "2nd Year";
    if (y.includes("2nd")) return "3rd Year";
    if (y.includes("3rd")) return "4th Year";
    if (y.includes("4th")) return null;
  }
  if (strand && strand.trim()) {
    if (y.includes("11")) return "Grade 12";
    if (y.includes("12")) return null;
  }
  return null;
}

function isFinalYear(yearLevel, course, strand) {
  const y = yearLevel?.toLowerCase() || "";
  if (course && course.trim()) return y.includes("4th");
  if (strand && strand.trim()) return y.includes("12");
  return false;
}

// ─── GET STUDENTS FOR REVIEW ─────────────────────────────────────────────────

exports.getStudentsForReview = async () => {
  const currentYearDoc = await AcademicYear.findOne({ isCurrent: true });
  const currentYear = currentYearDoc?.year || "";

  const allActive = await User.find({
    role: { $in: ["student", "ssc"] },
    $or: [
      { status: "active" },
      { status: { $exists: false } },
      { status: "" },
    ],
  })
    .select("-password -verificationToken -verificationTokenExpiry -__v")
    .lean();

  const finalYear = allActive.filter((s) => isFinalYear(s.yearLevel, s.course, s.strand));
  const nonFinal  = allActive.filter((s) => !isFinalYear(s.yearLevel, s.course, s.strand));

  return { finalYear, nonFinal, currentYear };
};

// ─── MAIN YEAR-END PROCESS ───────────────────────────────────────────────────

exports.processYearEnd = async (processedBy = "system") => {
  const currentYearDoc = await AcademicYear.findOne({ isCurrent: true });
  if (!currentYearDoc) throw new Error("No active academic year found. Create one first in Academic Years tab.");

  const currentYear = currentYearDoc.year;
  const nextYear    = getNextAcademicYear(currentYear);

  if (currentYearDoc.isClosed) throw new Error(`Academic year ${currentYear} is already closed`);

  let newYearDoc = await AcademicYear.findOne({ year: nextYear });
  if (!newYearDoc) {
    newYearDoc = await AcademicYear.create({ year: nextYear, isCurrent: true });
  } else {
    newYearDoc.isCurrent = true;
    await newYearDoc.save();
  }

  currentYearDoc.isCurrent = false;
  currentYearDoc.isClosed  = true;
  await currentYearDoc.save();

  const students = await User.find({
    role: { $in: ["student", "ssc"] },
    $or: [
      { status: "active" },
      { status: { $exists: false } },
      { status: "" },
    ],
  });

  const results = { promoted: 0, graduated: 0, skipped: 0 };

  for (const student of students) {
    const historyEntry = {
      fromYear: currentYear, fromYearLevel: student.yearLevel,
      processedAt: new Date(), processedBy,
    };

    if (isFinalYear(student.yearLevel, student.course, student.strand)) {
      historyEntry.toYear = currentYear; historyEntry.toYearLevel = student.yearLevel;
      historyEntry.action = "graduated";
      student.status = "graduated"; student.role = "graduate";
      student.graduationYear = new Date().getFullYear();
      student.academicYear = currentYear;
      results.graduated++;
    } else {
      const nextLevel = getNextYearLevel(student.yearLevel, student.course, student.strand);
      if (!nextLevel) { results.skipped++; continue; }
      historyEntry.toYear = nextYear; historyEntry.toYearLevel = nextLevel;
      historyEntry.action = "promoted";
      student.yearLevel = nextLevel; student.academicYear = nextYear;
      student.status = "active";
      results.promoted++;
    }

    student.promotionHistory.push(historyEntry);
    await student.save();
  }

  newYearDoc.summary = { totalPromoted: results.promoted, totalGraduated: results.graduated, processedAt: new Date() };
  await newYearDoc.save();

  return { message: "Year-end process completed successfully", previousYear: currentYear, nextAcademicYear: nextYear, results };
};

// ─── MANUAL PER-STUDENT ACTION ───────────────────────────────────────────────

exports.applyManualAction = async (studentIds, action, remarks = "", processedBy = "system") => {
  const currentYearDoc = await AcademicYear.findOne({ isCurrent: true });
  const currentYear = currentYearDoc?.year || "";
  const nextYear    = currentYear ? getNextAcademicYear(currentYear) : "";

  const results = [];

  for (const id of studentIds) {
    const student = await User.findById(id);
    if (!student) { results.push({ id, success: false, reason: "Student not found" }); continue; }

    const historyEntry = {
      fromYear: currentYear, fromYearLevel: student.yearLevel,
      processedAt: new Date(), processedBy, remarks,
    };

    if (action === "promote") {
      const nextLevel = getNextYearLevel(student.yearLevel, student.course, student.strand);
      if (!nextLevel) { results.push({ id, success: false, reason: "Already at final year. Use Graduate instead." }); continue; }
      historyEntry.toYear = nextYear; historyEntry.toYearLevel = nextLevel; historyEntry.action = "promoted";
      student.yearLevel = nextLevel; student.academicYear = nextYear; student.status = "active";
    }
    if (action === "graduate") {
      historyEntry.toYear = currentYear; historyEntry.toYearLevel = student.yearLevel; historyEntry.action = "graduated";
      student.status = "graduated"; student.role = "graduate";
      student.graduationYear = new Date().getFullYear(); student.academicYear = currentYear;
    }
    if (action === "fail") {
      historyEntry.toYear = currentYear; historyEntry.toYearLevel = student.yearLevel; historyEntry.action = "failed";
      student.status = "failed"; student.academicYear = currentYear;
    }
    if (action === "drop") {
      historyEntry.toYear = currentYear; historyEntry.toYearLevel = student.yearLevel; historyEntry.action = "dropped";
      student.status = "dropped"; student.academicYear = currentYear;
    }
    if (action === "irregular") {
      historyEntry.toYear = nextYear; historyEntry.toYearLevel = student.yearLevel; historyEntry.action = "irregular";
      student.status = "irregular"; student.academicYear = nextYear;
    }
    if (action === "on_leave") {
      historyEntry.toYear = currentYear; historyEntry.toYearLevel = student.yearLevel; historyEntry.action = "on_leave";
      student.status = "on_leave"; student.academicYear = currentYear;
    }

    student.yearEndRemarks = remarks || student.yearEndRemarks;
    student.promotionHistory.push(historyEntry);
    await student.save();
    results.push({ id, success: true, action, newStatus: student.status });
  }

  return results;
};

// ─── GET ALL ACADEMIC YEARS ───────────────────────────────────────────────────

exports.getAcademicYears = async () => {
  return AcademicYear.find().sort({ year: -1 }).lean();
};

// ─── CREATE ACADEMIC YEAR ────────────────────────────────────────────────────

exports.createAcademicYear = async (year, setAsCurrent = false) => {
  const exists = await AcademicYear.findOne({ year });
  if (exists) throw new Error(`Academic year ${year} already exists`);
  if (setAsCurrent) await AcademicYear.updateMany({}, { $set: { isCurrent: false } });
  return AcademicYear.create({ year, isCurrent: setAsCurrent });
};

// ─── 🆕 UPDATE ACADEMIC YEAR ─────────────────────────────────────────────────
// Can update: year string, isCurrent, startDate, endDate

exports.updateAcademicYear = async (id, updates) => {
  const yearDoc = await AcademicYear.findById(id);
  if (!yearDoc) throw new Error("Academic year not found");

  // If renaming the year string, check no duplicate
  if (updates.year && updates.year !== yearDoc.year) {
    const duplicate = await AcademicYear.findOne({ year: updates.year });
    if (duplicate) throw new Error(`Academic year ${updates.year} already exists`);
    yearDoc.year = updates.year;
  }

  // If setting as current, unset all others first
  if (updates.isCurrent === true) {
    await AcademicYear.updateMany({ _id: { $ne: id } }, { $set: { isCurrent: false } });
    yearDoc.isCurrent = true;
    yearDoc.isClosed  = false; // re-open if was closed
  }

  if (updates.isCurrent === false) yearDoc.isCurrent = false;
  if (updates.startDate !== undefined) yearDoc.startDate = updates.startDate;
  if (updates.endDate   !== undefined) yearDoc.endDate   = updates.endDate;

  await yearDoc.save();
  return yearDoc;
};

// ─── 🆕 DELETE ACADEMIC YEAR ─────────────────────────────────────────────────

exports.deleteAcademicYear = async (id) => {
  const yearDoc = await AcademicYear.findById(id);
  if (!yearDoc) throw new Error("Academic year not found");

  // Safety: cannot delete the currently active year
  if (yearDoc.isCurrent) throw new Error("Cannot delete the current active academic year. Set another year as current first.");

  await AcademicYear.findByIdAndDelete(id);
  return { deleted: true, year: yearDoc.year };
};

// ─── MIGRATION HELPER ────────────────────────────────────────────────────────

exports.migrateExistingStudents = async (defaultAcademicYear) => {
  if (!defaultAcademicYear) throw new Error("Provide a defaultAcademicYear (e.g. '2024-2025')");

  const result = await User.updateMany(
    {
      role: { $in: ["student", "ssc"] },
      $or: [
        { academicYear: { $exists: false } },
        { academicYear: "" },
        { status: { $exists: false } },
        { status: "" },
      ],
    },
    { $set: { academicYear: defaultAcademicYear, status: "active" } }
  );

  return { migratedCount: result.modifiedCount };
};