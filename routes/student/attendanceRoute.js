const express = require("express");
const router = express.Router();
const Attendance = require("../../models/Attendance");
const Event = require("../../models/Event");

// ==============================
// ✅ GET STUDENT'S OWN ATTENDANCE
// Only returns records whose event still exists in the DB.
// Orphaned records (deleted events) are hard-deleted automatically.
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
      .populate("sscId", "firstName lastName email photoURL")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    if (records.length === 0) {
      return res.status(200).json([]);
    }

    // Collect all unique eventIds
    const eventIds = [...new Set(records.map((r) => r.eventId?.toString()).filter(Boolean))];

    // Check which events still exist
    const existingEvents = await Event.find(
      { _id: { $in: eventIds } },
      "title startDate endDate location image participationType morningAttendance afternoonAttendance"
    ).lean();

    const existingEventIds = new Set(existingEvents.map((e) => e._id.toString()));

    // Separate valid vs orphaned
    const validRecordIds = [];
    const orphanedRecordIds = [];

    records.forEach((r) => {
      const eid = r.eventId?.toString();
      if (eid && existingEventIds.has(eid)) {
        validRecordIds.push(r._id);
      } else {
        orphanedRecordIds.push(r._id);
      }
    });

    // Hard-delete orphaned records
    if (orphanedRecordIds.length > 0) {
      await Attendance.deleteMany({ _id: { $in: orphanedRecordIds } });
      console.log(`🗑️ Auto-cleaned ${orphanedRecordIds.length} orphaned record(s) for student ${userId}`);
    }

    // Build event map
    const eventMap = {};
    existingEvents.forEach((e) => {
      eventMap[e._id.toString()] = e;
    });

    // Return valid records with full event info
    const validRecords = records
      .filter((r) => validRecordIds.some((id) => id.toString() === r._id.toString()))
      .map((r) => ({
        ...r,
        eventId: eventMap[r.eventId?.toString()] || null,
      }));

    console.log(
      `✅ Returning ${validRecords.length} valid records (cleaned ${orphanedRecordIds.length} orphaned) for student ${userId}`
    );

    res.status(200).json(validRecords);
  } catch (err) {
    console.error("❌ Error fetching student attendance:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ==============================
// ✅ DELETE STUDENT'S ATTENDANCE FOR A SPECIFIC DATE
// DELETE /?userId=xxx&date=YYYY-MM-DD
// ==============================
router.delete("/", async (req, res) => {
  try {
    const { userId, date } = req.query;

    console.log("🗑️ Delete attendance by date:", { userId, date });

    if (!userId || !date) {
      return res.status(400).json({ error: "userId and date are required" });
    }

    const result = await Attendance.deleteMany({ studentId: userId, date });

    console.log(`✅ Deleted ${result.deletedCount} record(s) for student ${userId} on ${date}`);

    res.status(200).json({
      message: `Deleted ${result.deletedCount} attendance record(s) for ${date}`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("❌ Error deleting attendance by date:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;