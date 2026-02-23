const express = require("express");
const router = express.Router();
const Attendance = require("../../models/Attendance");

// ============================== 
// ✅ GET STUDENT'S OWN ATTENDANCE
// ============================== 
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    console.log("📥 Student attendance request:", { userId });

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Fetch all attendance records for this student
    const records = await Attendance.find({ studentId: userId })
      .populate("eventId", "title startDate endDate location image")
      .populate("sscId", "firstName lastName")
      .sort({ date: -1, createdAt: -1 }) // Most recent first
      .lean();

    // ✅ Filter out records whose event has been deleted (eventId populated as null)
    const validRecords = records.filter((r) => r.eventId !== null && r.eventId !== undefined);

    console.log(
      `✅ Found ${records.length} total records, ${validRecords.length} with active events for student ${userId}`
    );

    res.status(200).json(validRecords);
  } catch (err) {
    console.error("❌ Error fetching student attendance:", err);
    res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

module.exports = router;