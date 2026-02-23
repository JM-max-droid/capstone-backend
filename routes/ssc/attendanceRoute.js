// ==========================================
// routes/ssc/attendanceRoute.js
// SSC can only VIEW attendance — no CRUD, no mark absent, no export
// ==========================================
const express = require("express");
const router = express.Router();
const { getAttendance } = require("../../controllers/attendanceControllers");

// ✅ SSC: View attendance records only
router.get("/", getAttendance);

module.exports = router;