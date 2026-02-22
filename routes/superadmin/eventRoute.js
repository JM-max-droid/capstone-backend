const express = require("express");
const { getEvents, createEvent, updateEvent, deleteEvent } = require("../../controllers/eventControllers");

const router = express.Router();

// 🔹 GET all events
router.get("/", getEvents);

// 🔹 POST new event
router.post("/", createEvent);

// 🔹 PUT update an event by ID
router.put("/:id", updateEvent);

// 🔹 DELETE an event by ID
router.delete("/:id", deleteEvent);

module.exports = router;