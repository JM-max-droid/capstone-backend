// routes/oss/studentRoute.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/oss/studentController");
const pendingController = require("../../controllers/pendingStudentController");

// ── Existing routes (unchanged) ───────────────────────────────────────────────

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

// PUT update student by ID number
router.put("/:idNumber", controller.updateStudent);

// DELETE student by ID number
router.delete("/:idNumber", controller.deleteStudent);

// ── New pending approval routes ───────────────────────────────────────────────

// GET all pending submissions (with optional ?status=pending|approved|rejected|all)
router.get("/pending", pendingController.getPendingStudents);

// POST approve a pending submission → creates the student record
router.post("/pending/:id/approve", pendingController.approveStudent);

// POST reject a pending submission (with reason in body)
router.post("/pending/:id/reject", pendingController.rejectStudent);

// DELETE a pending record (cleanup)
router.delete("/pending/:id", pendingController.deletePendingStudent);

module.exports = router;