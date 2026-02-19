const User = require("../models/User");
const AcademicYear = require("../models/AcademicYear");

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function getNextAcademicYear(current) {
  const [start, end] = current.split("-").map(Number);
  return `${start + 1}-${end + 1}`;
}

function getNextYearLevel(yearLevel, course, strand) {
  const y = yearLevel?.toLowerCase() || "";

  if (course && course.trim()) {
    // College
    if (y.includes("1st")) return "2nd Year";
    if (y.includes("2nd")) return "3rd Year";
    if (y.includes("3rd")) return "4th Year";
    if (y.includes("4th")) return null; // Final year
  }

  if (strand && strand.trim()) {
    // Senior High School
    if (y.includes("11")) return "12";
    if (y.includes("12")) return null; // Final year
  }

  return null;
}

function isFinalYear(yearLevel, course, strand) {
  const y = yearLevel?.toLowerCase() || "";
  if (course && course.trim()) return y.includes("4th");
  if (strand && strand.trim()) return y.includes("12");
  return false;
}

// ─── MAIN YEAR-END PROCESS ───────────────────────────────────────────────────

/**
 * Runs full automated year-end process:
 * - Promotes active non-final students
 * - Graduates active final-year students
 * - Creates next academic year doc
 * - Saves summary stats
 */
exports.processYearEnd = async (processedBy = "system") => {
  const currentYearDoc = await AcademicYear.findOne({ isCurrent: true });
  if (!currentYearDoc) throw new Error("No active academic year found");

  const currentYear = currentYearDoc.year;
  const nextYear = getNextAcademicYear(currentYear);

  // Prevent running twice
  if (currentYearDoc.isClosed) {
    throw new Error(`Academic year ${currentYear} is already closed`);
  }

  // Check if next year already exists
  let newYearDoc = await AcademicYear.findOne({ year: nextYear });
  if (!newYearDoc) {
    newYearDoc = await AcademicYear.create({ year: nextYear, isCurrent: true });
  } else {
    newYearDoc.isCurrent = true;
    await newYearDoc.save();
  }

  // Close current year
  currentYearDoc.isCurrent = false;
  currentYearDoc.isClosed = true;
  await currentYearDoc.save();

  // Only process students that are "active" and belong to current academic year
  const students = await User.find({
    role: { $in: ["student", "ssc"] },
    academicYear: currentYear,
    status: "active",
  });

  const results = {
    promoted:  0,
    graduated: 0,
    skipped:   0,
  };

  for (const student of students) {
    const historyEntry = {
      fromYear:      currentYear,
      fromYearLevel: student.yearLevel,
      processedAt:   new Date(),
      processedBy,
    };

    if (isFinalYear(student.yearLevel, student.course, student.strand)) {
      // Graduate
      historyEntry.toYear      = currentYear;
      historyEntry.toYearLevel = student.yearLevel;
      historyEntry.action      = "graduated";

      student.status         = "graduated";
      student.role           = "graduate";
      student.graduationYear = new Date().getFullYear();
    } else {
      const nextLevel = getNextYearLevel(student.yearLevel, student.course, student.strand);
      if (!nextLevel) {
        results.skipped++;
        continue;
      }

      historyEntry.toYear      = nextYear;
      historyEntry.toYearLevel = nextLevel;
      historyEntry.action      = "promoted";

      student.yearLevel    = nextLevel;
      student.academicYear = nextYear;
      student.status       = "active";
      results.promoted++;
    }

    if (historyEntry.action === "graduated") results.graduated++;

    student.promotionHistory.push(historyEntry);
    await student.save();
  }

  // Save summary to academic year doc
  newYearDoc.summary = {
    totalPromoted:  results.promoted,
    totalGraduated: results.graduated,
    processedAt:    new Date(),
  };
  await newYearDoc.save();

  return {
    message:           "Year-end process completed successfully",
    previousYear:      currentYear,
    nextAcademicYear:  nextYear,
    results,
  };
};

// ─── MANUAL PER-STUDENT ACTION ───────────────────────────────────────────────

/**
 * action: "promote" | "graduate" | "fail" | "drop" | "irregular" | "on_leave"
 * studentIds: array of MongoDB _id strings
 */
exports.applyManualAction = async (studentIds, action, remarks = "", processedBy = "system") => {
  const currentYearDoc = await AcademicYear.findOne({ isCurrent: true });
  const currentYear = currentYearDoc?.year || "";
  const nextYear = currentYear ? getNextAcademicYear(currentYear) : "";

  const results = [];

  for (const id of studentIds) {
    const student = await User.findById(id);
    if (!student) {
      results.push({ id, success: false, reason: "Student not found" });
      continue;
    }

    const historyEntry = {
      fromYear:      currentYear,
      fromYearLevel: student.yearLevel,
      processedAt:   new Date(),
      processedBy,
      remarks,
    };

    if (action === "promote") {
      const nextLevel = getNextYearLevel(student.yearLevel, student.course, student.strand);
      if (!nextLevel) {
        results.push({ id, success: false, reason: "Already at final year. Use Graduate instead." });
        continue;
      }
      historyEntry.toYear      = nextYear;
      historyEntry.toYearLevel = nextLevel;
      historyEntry.action      = "promoted";
      student.yearLevel        = nextLevel;
      student.academicYear     = nextYear;
      student.status           = "active";
    }

    if (action === "graduate") {
      historyEntry.toYear      = currentYear;
      historyEntry.toYearLevel = student.yearLevel;
      historyEntry.action      = "graduated";
      student.status           = "graduated";
      student.role             = "graduate";
      student.graduationYear   = new Date().getFullYear();
    }

    if (action === "fail") {
      historyEntry.toYear      = currentYear;
      historyEntry.toYearLevel = student.yearLevel;
      historyEntry.action      = "failed";
      student.status           = "failed";
    }

    if (action === "drop") {
      historyEntry.toYear      = currentYear;
      historyEntry.toYearLevel = student.yearLevel;
      historyEntry.action      = "dropped";
      student.status           = "dropped";
    }

    if (action === "irregular") {
      historyEntry.toYear      = nextYear;
      historyEntry.toYearLevel = student.yearLevel; // stays same year level
      historyEntry.action      = "irregular";
      student.status           = "irregular";
      student.academicYear     = nextYear;
    }

    if (action === "on_leave") {
      historyEntry.toYear      = currentYear;
      historyEntry.toYearLevel = student.yearLevel;
      historyEntry.action      = "on_leave";
      student.status           = "on_leave";
    }

    student.yearEndRemarks = remarks || student.yearEndRemarks;
    student.promotionHistory.push(historyEntry);
    await student.save();
    results.push({ id, success: true, action, newStatus: student.status });
  }

  return results;
};

// ─── GET STUDENTS FOR PROMOTION REVIEW ───────────────────────────────────────

exports.getStudentsForReview = async () => {
  const currentYearDoc = await AcademicYear.findOne({ isCurrent: true });
  const currentYear = currentYearDoc?.year || "";

  const allActive = await User.find({
    role: { $in: ["student", "ssc"] },
    academicYear: currentYear,
    status: "active",
  })
    .select("-password -verificationToken -verificationTokenExpiry -__v")
    .lean();

  const finalYear = allActive.filter((s) =>
    isFinalYear(s.yearLevel, s.course, s.strand)
  );
  const nonFinal = allActive.filter(
    (s) => !isFinalYear(s.yearLevel, s.course, s.strand)
  );

  return { finalYear, nonFinal, currentYear };
};

// ─── GET ALL ACADEMIC YEARS ───────────────────────────────────────────────────

exports.getAcademicYears = async () => {
  return AcademicYear.find().sort({ year: -1 }).lean();
};

// ─── CREATE ACADEMIC YEAR ────────────────────────────────────────────────────

exports.createAcademicYear = async (year, setAsCurrent = false) => {
  const exists = await AcademicYear.findOne({ year });
  if (exists) throw new Error(`Academic year ${year} already exists`);

  if (setAsCurrent) {
    await AcademicYear.updateMany({}, { $set: { isCurrent: false } });
  }

  return AcademicYear.create({ year, isCurrent: setAsCurrent });
};

// ─── MIGRATION HELPER ────────────────────────────────────────────────────────
// Run once to patch existing students that have no academicYear / status

exports.migrateExistingStudents = async (defaultAcademicYear) => {
  if (!defaultAcademicYear) throw new Error("Provide a defaultAcademicYear (e.g. '2024-2025')");

  const result = await User.updateMany(
    {
      role: { $in: ["student", "ssc"] },
      $or: [
        { academicYear: { $exists: false } },
        { academicYear: "" },
        { status: { $exists: false } },
      ],
    },
    {
      $set: {
        academicYear: defaultAcademicYear,
        status: "active",
      },
    }
  );

  return { migratedCount: result.modifiedCount };
};