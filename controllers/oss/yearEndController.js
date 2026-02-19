const yearEndService = require("../../services/yearEndService");

// ─── RUN FULL YEAR-END PROCESS ───────────────────────────────────────────────
exports.runYearEnd = async (req, res) => {
  try {
    const processedBy = req.user?.idNumber?.toString() || "system";
    const result = await yearEndService.processYearEnd(processedBy);
    res.json(result);
  } catch (err) {
    console.error("Year-End Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── MANUAL ACTION ON SELECTED STUDENTS ─────────────────────────────────────
exports.manualAction = async (req, res) => {
  try {
    const { studentIds, action, remarks } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0)
      return res.status(400).json({ error: "No students selected" });

    const validActions = ["promote", "graduate", "fail", "drop", "irregular", "on_leave"];
    if (!validActions.includes(action))
      return res.status(400).json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` });

    const processedBy = req.user?.idNumber?.toString() || "system";
    const results     = await yearEndService.applyManualAction(studentIds, action, remarks || "", processedBy);
    const successful  = results.filter((r) => r.success).length;
    const failed      = results.filter((r) => !r.success).length;

    res.json({ message: `Action applied: ${successful} succeeded, ${failed} failed`, results });
  } catch (err) {
    console.error("Manual Action Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET STUDENTS FOR REVIEW ─────────────────────────────────────────────────
exports.getStudentsForReview = async (req, res) => {
  try {
    const data = await yearEndService.getStudentsForReview();
    res.json(data);
  } catch (err) {
    console.error("Get for review error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET ALL ACADEMIC YEARS ───────────────────────────────────────────────────
exports.getAcademicYears = async (req, res) => {
  try {
    const years = await yearEndService.getAcademicYears();
    res.json({ years });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── CREATE ACADEMIC YEAR ─────────────────────────────────────────────────────
exports.createAcademicYear = async (req, res) => {
  try {
    const { year, setAsCurrent = false } = req.body;
    if (!year) return res.status(400).json({ error: "Year is required (e.g. 2025-2026)" });
    const newYear = await yearEndService.createAcademicYear(year, setAsCurrent);
    res.status(201).json({ message: "Academic year created", year: newYear });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── 🆕 UPDATE ACADEMIC YEAR ─────────────────────────────────────────────────
// PATCH /api/year-end/academic-years/:id
// Body: { year?: "2025-2026", isCurrent?: true, startDate?: "...", endDate?: "..." }
exports.updateAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) return res.status(400).json({ error: "Academic year ID is required" });

    const updated = await yearEndService.updateAcademicYear(id, updates);
    res.json({ message: "Academic year updated successfully", year: updated });
  } catch (err) {
    console.error("Update Academic Year Error:", err);
    res.status(400).json({ error: err.message });
  }
};

// ─── 🆕 DELETE ACADEMIC YEAR ─────────────────────────────────────────────────
// DELETE /api/year-end/academic-years/:id
exports.deleteAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Academic year ID is required" });

    const result = await yearEndService.deleteAcademicYear(id);
    res.json({ message: `Academic year ${result.year} deleted successfully` });
  } catch (err) {
    console.error("Delete Academic Year Error:", err);
    res.status(400).json({ error: err.message });
  }
};

// ─── MIGRATION ───────────────────────────────────────────────────────────────
exports.migrateStudents = async (req, res) => {
  try {
    const { defaultAcademicYear } = req.body;
    const result = await yearEndService.migrateExistingStudents(defaultAcademicYear);
    res.json({ message: "Migration complete", ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};