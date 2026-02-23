// routes/ssc/attendanceRoute.js
const express = require("express");
const router = express.Router();
const { getAttendance, createAttendance } = require("../../controllers/attendanceControllers");

// ✅ SSC: View attendance records
router.get("/", getAttendance);

// ✅ SSC: Mark attendance (time in / time out)
router.post("/", createAttendance);

module.exports = router;