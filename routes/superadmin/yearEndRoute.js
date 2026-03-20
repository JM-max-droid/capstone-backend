const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/yearEndController");

// ─── ACADEMIC YEAR MANAGEMENT ─────────────────────────────────────────────────
router.get("/academic-years",        ctrl.getAcademicYears);
router.post("/academic-years",       ctrl.createAcademicYear);
router.patch("/academic-years/:id",  ctrl.updateAcademicYear);
router.delete("/academic-years/:id", ctrl.deleteAcademicYear);

// ─── REVIEW STUDENTS BEFORE YEAR-END ─────────────────────────────────────────
router.get("/review",                ctrl.getStudentsForReview);

// ─── MANUAL PER-STUDENT ACTION ────────────────────────────────────────────────
router.post("/manual-action",        ctrl.manualAction);

// ─── REVERT STUDENT BACK TO ACTIVE ───────────────────────────────────────────
router.post("/revert-action",        ctrl.revertAction);

// ─── DELETE STUDENTS PERMANENTLY ─────────────────────────────────────────────
router.post("/delete-students",      ctrl.deleteStudents);

// ─── FULL AUTOMATED YEAR-END PROCESS ─────────────────────────────────────────
router.post("/run",                  ctrl.runYearEnd);

// ─── ONE-TIME MIGRATION ───────────────────────────────────────────────────────
router.post("/migrate",              ctrl.migrateStudents);

module.exports = router;