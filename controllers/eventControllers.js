const Event = require("../models/Event");

// ─── Helper: parse "hh:mm AM/PM" → total minutes from midnight ───────────────
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return -1;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return -1;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === "AM") {
    if (hours === 12) hours = 0;
  } else {
    if (hours !== 12) hours += 12;
  }
  return hours * 60 + minutes;
};

const isAM = (t) => /AM/i.test(t || "");
const isPM = (t) => /PM/i.test(t || "");

// ─── Validate session times → returns error string or null ───────────────────
const validateSessionTimes = ({
  morningStart, morningEnd, morningTimeout,
  afternoonStart, afternoonEnd, afternoonTimeout,
}) => {
  // ── MORNING: all must be AM ──────────────────────────────────────────────
  if (morningStart && !isAM(morningStart))
    return "Morning start time must be AM (12:00 AM – 11:59 AM).";
  if (morningEnd && !isAM(morningEnd))
    return "Morning end time must be AM (12:00 AM – 11:59 AM).";
  if (morningTimeout && !isAM(morningTimeout))
    return "Morning timeout must be AM (12:00 AM – 11:59 AM).";

  // ── MORNING: start ≠ end, start < end ────────────────────────────────────
  if (morningStart && morningEnd) {
    const mS = parseTimeToMinutes(morningStart);
    const mE = parseTimeToMinutes(morningEnd);
    if (mS === mE)
      return "Morning session start and end time cannot be the same.";
    if (mS > mE)
      return "Morning start time must be earlier than end time.";
  }

  // ── MORNING: timeout inside [start, end] ─────────────────────────────────
  if (morningStart && morningEnd && morningTimeout) {
    const mS = parseTimeToMinutes(morningStart);
    const mE = parseTimeToMinutes(morningEnd);
    const mT = parseTimeToMinutes(morningTimeout);
    if (mT <= mS || mT > mE)
      return "Morning timeout must be within the session start and end times.";
  }

  // ── AFTERNOON: all must be PM ────────────────────────────────────────────
  if (afternoonStart && !isPM(afternoonStart))
    return "Afternoon start time must be PM (12:00 PM – 11:59 PM).";
  if (afternoonEnd && !isPM(afternoonEnd))
    return "Afternoon end time must be PM (12:00 PM – 11:59 PM).";
  if (afternoonTimeout && !isPM(afternoonTimeout))
    return "Afternoon timeout must be PM (12:00 PM – 11:59 PM).";

  // ── AFTERNOON: start ≠ end, start < end ──────────────────────────────────
  if (afternoonStart && afternoonEnd) {
    const aS = parseTimeToMinutes(afternoonStart);
    const aE = parseTimeToMinutes(afternoonEnd);
    if (aS === aE)
      return "Afternoon session start and end time cannot be the same.";
    if (aS > aE)
      return "Afternoon start time must be earlier than end time.";
  }

  // ── AFTERNOON: timeout inside [start, end] ───────────────────────────────
  if (afternoonStart && afternoonEnd && afternoonTimeout) {
    const aS = parseTimeToMinutes(afternoonStart);
    const aE = parseTimeToMinutes(afternoonEnd);
    const aT = parseTimeToMinutes(afternoonTimeout);
    if (aT <= aS || aT > aE)
      return "Afternoon timeout must be within the session start and end times.";
  }

  return null;
};

// ─── Validate dates → returns error string or null ───────────────────────────
const validateDates = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const s = new Date(startDate);
  const e = new Date(endDate);
  const sDay = s.toISOString().split("T")[0];
  const eDay = e.toISOString().split("T")[0];
  if (sDay === eDay)
    return "Start date and end date must be different days.";
  if (e < s)
    return "End date must be after start date.";
  return null;
};

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
      title, description, startDate, endDate,
      morningAttendanceStart, morningAttendanceEnd, morningAllottedTime, morningTimeout,
      afternoonAttendanceStart, afternoonAttendanceEnd, afternoonAllottedTime, afternoonTimeout,
      location, fines, image, createdBy, participationType, families,
    } = req.body;

    // ── Required fields ──────────────────────────────────────────────────────
    if (
      !title || !startDate || !endDate || !location || !participationType ||
      !morningAttendanceStart || !morningAttendanceEnd || !morningTimeout ||
      !afternoonAttendanceStart || !afternoonAttendanceEnd || !afternoonTimeout
    ) {
      return res.status(400).json({ error: "Required fields missing (including timeout)." });
    }

    // ── Date validation ──────────────────────────────────────────────────────
    const dateError = validateDates(startDate, endDate);
    if (dateError) return res.status(400).json({ error: dateError });

    // ── AM/PM + time order + same-time + timeout validation ──────────────────
    const timeError = validateSessionTimes({
      morningStart: morningAttendanceStart,
      morningEnd: morningAttendanceEnd,
      morningTimeout,
      afternoonStart: afternoonAttendanceStart,
      afternoonEnd: afternoonAttendanceEnd,
      afternoonTimeout,
    });
    if (timeError) return res.status(400).json({ error: timeError });

    // ── Family validation ────────────────────────────────────────────────────
    if (participationType === "FAMILY" && (!families || families.length === 0)) {
      return res.status(400).json({ error: "Please select families." });
    }

    const event = new Event({
      title, description, startDate, endDate, location,
      fines: Number(fines || 0), image, createdBy, participationType,
      families: participationType === "FAMILY" ? families : [],
      morningAttendance: {
        start: morningAttendanceStart, end: morningAttendanceEnd,
        allottedTime: Number(morningAllottedTime || 30), timeout: morningTimeout,
      },
      afternoonAttendance: {
        start: afternoonAttendanceStart, end: afternoonAttendanceEnd,
        allottedTime: Number(afternoonAllottedTime || 30), timeout: afternoonTimeout,
      },
    });

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to create event", details: error.message });
  }
};

// 🔹 UPDATE EVENT
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // ── Resolve final values (merge incoming with existing) ──────────────────
    const newStart = req.body.startDate || event.startDate;
    const newEnd   = req.body.endDate   || event.endDate;

    // ── Date validation ──────────────────────────────────────────────────────
    const dateError = validateDates(newStart, newEnd);
    if (dateError) return res.status(400).json({ error: dateError });

    const mStart   = req.body.morningAttendanceStart   || event.morningAttendance.start;
    const mEnd     = req.body.morningAttendanceEnd     || event.morningAttendance.end;
    const mTimeout = req.body.morningTimeout           || event.morningAttendance.timeout;
    const aStart   = req.body.afternoonAttendanceStart || event.afternoonAttendance.start;
    const aEnd     = req.body.afternoonAttendanceEnd   || event.afternoonAttendance.end;
    const aTimeout = req.body.afternoonTimeout         || event.afternoonAttendance.timeout;

    // ── AM/PM + time order + same-time + timeout validation ──────────────────
    const timeError = validateSessionTimes({
      morningStart: mStart, morningEnd: mEnd, morningTimeout: mTimeout,
      afternoonStart: aStart, afternoonEnd: aEnd, afternoonTimeout: aTimeout,
    });
    if (timeError) return res.status(400).json({ error: timeError });

    // ── Family validation ────────────────────────────────────────────────────
    const newType = req.body.participationType || event.participationType;
    if (newType === "FAMILY") {
      const newFamilies = req.body.families ?? event.families;
      if (!newFamilies || newFamilies.length === 0)
        return res.status(400).json({ error: "Please select families." });
    }

    // ── Apply updates ────────────────────────────────────────────────────────
    event.morningAttendance = {
      start: mStart, end: mEnd,
      allottedTime: req.body.morningAllottedTime !== undefined
        ? Number(req.body.morningAllottedTime)
        : event.morningAttendance.allottedTime,
      timeout: mTimeout,
    };
    event.afternoonAttendance = {
      start: aStart, end: aEnd,
      allottedTime: req.body.afternoonAllottedTime !== undefined
        ? Number(req.body.afternoonAllottedTime)
        : event.afternoonAttendance.allottedTime,
      timeout: aTimeout,
    };

    if (req.body.title       !== undefined) event.title       = req.body.title;
    if (req.body.description !== undefined) event.description = req.body.description;
    if (req.body.startDate   !== undefined) event.startDate   = req.body.startDate;
    if (req.body.endDate     !== undefined) event.endDate     = req.body.endDate;
    if (req.body.location    !== undefined) event.location    = req.body.location;
    if (req.body.fines       !== undefined) event.fines       = Number(req.body.fines);
    if (req.body.image       !== undefined) event.image       = req.body.image;
    if (req.body.createdBy   !== undefined) event.createdBy   = req.body.createdBy;

    if (req.body.participationType !== undefined) {
      event.participationType = req.body.participationType;
      if (req.body.participationType === "ALL") event.families = [];
    }
    if (req.body.families !== undefined) event.families = req.body.families;

    await event.save();
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to update event", details: error.message });
  }
};

// 🔹 DELETE EVENT
const deleteEvent = async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Event not found" });
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete event", details: error.message });
  }
};

module.exports = { getEvents, createEvent, updateEvent, deleteEvent };