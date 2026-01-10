// ==========================================
// FILE 1: routes/oss/attendanceRoute.js
// ==========================================
const express = require("express");
const router = express.Router();
const {
  createAttendance,
  getAttendance,
  autoMarkAbsent,
  updateAttendance,
  deleteAttendance,
  exportAttendance, // ✅ ADD THIS - kasi may function na sa controller
} = require("../../controllers/attendanceControllers");

// SSC scan - create attendance
router.post("/", createAttendance);

// View attendance
router.get("/", getAttendance);

// Auto mark absent
router.post("/auto-absent", autoMarkAbsent);

// Update attendance manually
router.patch("/:id", updateAttendance);

// Delete attendance
router.delete("/:id", deleteAttendance);

// ✅ EXPORT TO EXCEL - KEEP THIS!
router.get("/export", exportAttendance);

module.exports = router;