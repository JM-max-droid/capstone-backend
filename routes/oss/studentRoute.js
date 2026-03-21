// routes/oss/studentRoute.js
const express = require("express");
const router = express.Router();

// FIX: correct path — controller lives in controllers/oss/
const controller        = require("../../controllers/oss/studentController");
const pendingController = require("../../controllers/oss/pendingStudentController");

// ── Pending approval routes (MUST be before /:idNumber) ──────────────────────
// NOTE: If these are declared after /:idNumber, Express will match "/pending"
// as an idNumber param and never reach these handlers.

// GET all pending submissions (?status=pending|approved|rejected|all)
router.get("/pending", pendingController.getPendingStudents);

// POST approve a pending submission → creates the student record
router.post("/pending/:id/approve", pendingController.approveStudent);

// POST reject a pending submission (with reason in body)
router.post("/pending/:id/reject", pendingController.rejectStudent);

// DELETE a single pending record (cleanup)
router.delete("/pending/:id", pendingController.deletePendingStudent);

// DELETE all approved/rejected records of a given status
router.delete("/pending/clear/:status", pendingController.clearByStatus);

// DELETE all approved + rejected records
router.delete("/pending/clear-all", pendingController.clearAll);

// ── Student / SSC routes ──────────────────────────────────────────────────────

// GET all students/ssc with filters
router.get("/", controller.getStudents);

// POST add new student
router.post("/", controller.addStudent);

// POST convert student to SSC
router.post("/convert-to-ssc", controller.convertToSSC);

// POST remove SSC status (convert back to student)
router.post("/remove-from-ssc", controller.removeFromSSC);

// POST reset student password
router.post("/reset-password", controller.resetPassword);

// PUT update student by ID number  ← dynamic route, must stay AFTER all static routes
router.put("/:idNumber", controller.updateStudent);

// DELETE student by ID number  ← dynamic route, must stay AFTER all static routes
router.delete("/:idNumber", controller.deleteStudent);

module.exports = router;