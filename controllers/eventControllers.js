const Event = require("../models/Event");

// 🔹 GET ALL EVENTS
const getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ startDate: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

// 🔹 CREATE EVENT
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,

      morningAttendanceStart,
      morningAttendanceEnd,
      morningAllottedTime,
      morningTimeout,

      afternoonAttendanceStart,
      afternoonAttendanceEnd,
      afternoonAllottedTime,
      afternoonTimeout,

      location,
      fines,
      image,
      createdBy,
      participationType,
      families,
    } = req.body;

    // ❗ REQUIRED VALIDATION (WALANG OPTIONAL)
    if (
      !title ||
      !startDate ||
      !endDate ||
      !location ||
      !participationType ||
      !morningAttendanceStart ||
      !morningAttendanceEnd ||
      !morningTimeout ||
      !afternoonAttendanceStart ||
      !afternoonAttendanceEnd ||
      !afternoonTimeout
    ) {
      return res.status(400).json({
        error: "Required fields missing (including timeout)",
      });
    }

    if (participationType === "FAMILY") {
      if (!families || families.length === 0) {
        return res
          .status(400)
          .json({ error: "Please select families" });
      }
    }

    const event = new Event({
      title,
      description,
      startDate,
      endDate,
      location,
      fines: Number(fines || 0),
      image,
      createdBy,
      participationType,
      families: participationType === "FAMILY" ? families : [],

      morningAttendance: {
        start: morningAttendanceStart,
        end: morningAttendanceEnd,
        allottedTime: Number(morningAllottedTime),
        timeout: morningTimeout,
      },

      afternoonAttendance: {
        start: afternoonAttendanceStart,
        end: afternoonAttendanceEnd,
        allottedTime: Number(afternoonAllottedTime),
        timeout: afternoonTimeout,
      },
    });

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create event",
      details: error.message,
    });
  }
};

// 🔹 UPDATE EVENT
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // 🔄 MORNING UPDATE
    if (
      req.body.morningAttendanceStart ||
      req.body.morningAttendanceEnd ||
      req.body.morningAllottedTime !== undefined ||
      req.body.morningTimeout
    ) {
      event.morningAttendance = {
        start:
          req.body.morningAttendanceStart ||
          event.morningAttendance.start,
        end:
          req.body.morningAttendanceEnd ||
          event.morningAttendance.end,
        allottedTime:
          req.body.morningAllottedTime !== undefined
            ? Number(req.body.morningAllottedTime)
            : event.morningAttendance.allottedTime,
        timeout:
          req.body.morningTimeout ||
          event.morningAttendance.timeout,
      };
    }

    // 🔄 AFTERNOON UPDATE
    if (
      req.body.afternoonAttendanceStart ||
      req.body.afternoonAttendanceEnd ||
      req.body.afternoonAllottedTime !== undefined ||
      req.body.afternoonTimeout
    ) {
      event.afternoonAttendance = {
        start:
          req.body.afternoonAttendanceStart ||
          event.afternoonAttendance.start,
        end:
          req.body.afternoonAttendanceEnd ||
          event.afternoonAttendance.end,
        allottedTime:
          req.body.afternoonAllottedTime !== undefined
            ? Number(req.body.afternoonAllottedTime)
            : event.afternoonAttendance.allottedTime,
        timeout:
          req.body.afternoonTimeout ||
          event.afternoonAttendance.timeout,
      };
    }

    // 🔄 OTHER FIELDS
    if (req.body.title !== undefined) event.title = req.body.title;
    if (req.body.description !== undefined)
      event.description = req.body.description;
    if (req.body.startDate !== undefined)
      event.startDate = req.body.startDate;
    if (req.body.endDate !== undefined)
      event.endDate = req.body.endDate;
    if (req.body.location !== undefined)
      event.location = req.body.location;
    if (req.body.fines !== undefined)
      event.fines = Number(req.body.fines);
    if (req.body.image !== undefined) event.image = req.body.image;
    if (req.body.createdBy !== undefined)
      event.createdBy = req.body.createdBy;

    if (req.body.participationType !== undefined) {
      event.participationType = req.body.participationType;
      if (req.body.participationType === "ALL") {
        event.families = [];
      }
    }

    if (req.body.families !== undefined) {
      event.families = req.body.families;
    }

    await event.save();
    res.json(event);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update event",
      details: error.message,
    });
  }
};

// 🔹 DELETE EVENT
const deleteEvent = async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete event",
      details: error.message,
    });
  }
};

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};
