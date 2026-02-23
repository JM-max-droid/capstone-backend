const express = require("express");
const Event = require("../../models/Event");

const router = express.Router();

// 🔹 GET all events — SSC can view events posted by OSS and Super Admin
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ startDate: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// 🔹 GET single event by ID
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

module.exports = router;