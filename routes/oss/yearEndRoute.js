const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/oss/yearEndController");

// ─── ACADEMIC YEAR MANAGEMENT ────────────────────────────────────────────────
router.get("/academic-years",      ctrl.getAcademicYears);
router.post("/academic-years",     ctrl.createAcademicYear);

// ─── REVIEW STUDENTS BEFORE YEAR-END ────────────────────────────────────────
router.get("/review",              ctrl.getStudentsForReview);

// ─── MANUAL PER-STUDENT ACTION ───────────────────────────────────────────────
router.post("/manual-action",      ctrl.manualAction);

// ─── FULL AUTOMATED YEAR-END PROCESS ────────────────────────────────────────
router.post("/run",                ctrl.runYearEnd);

// ─── ONE-TIME MIGRATION ──────────────────────────────────────────────────────
router.post("/migrate",            ctrl.migrateStudents);

module.exports = router;