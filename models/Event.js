const mongoose = require("mongoose");

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Sub-schema ───────────────────────────────────────────────────────────────
const attendanceTimeSchema = new mongoose.Schema(
  {
    start:       { type: String, required: true },
    end:         { type: String, required: true },
    allottedTime:{ type: Number, required: true },
    timeout:     { type: String, required: true },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const eventSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },
    morningAttendance:   { type: attendanceTimeSchema, required: true },
    afternoonAttendance: { type: attendanceTimeSchema, required: true },
    location:    { type: String, required: true, trim: true },
    fines:       { type: Number, default: 0 },
    image:       { type: String, default: "" },
    createdBy:   { type: String, default: "OSS Admin" },
    participationType: {
      type: String, enum: ["ALL", "FAMILY"], required: true, default: "ALL",
    },
    families: {
      type: [Number],
      default: [],
      validate: {
        validator: function (arr) {
          if (this.participationType === "FAMILY") {
            return arr.length > 0 && arr.every((n) => n >= 1 && n <= 12);
          }
          return true;
        },
        message: "Family numbers must be between 1 and 12 and cannot be empty.",
      },
    },
  },
  { timestamps: true }
);

// ─── Pre-validate: date + AM/PM + time order + timeout checks ────────────────
eventSchema.pre("validate", function (next) {
  const errors = [];

  // ── Dates: different days, end > start ────────────────────────────────────
  if (this.startDate && this.endDate) {
    const sDay = new Date(this.startDate).toISOString().split("T")[0];
    const eDay = new Date(this.endDate).toISOString().split("T")[0];
    if (sDay === eDay)
      errors.push("Start date and end date must be different days.");
    else if (new Date(this.endDate) < new Date(this.startDate))
      errors.push("End date must be after start date.");
  }

  // ── Morning: all AM ───────────────────────────────────────────────────────
  const m = this.morningAttendance;
  if (m) {
    if (m.start && !isAM(m.start))
      errors.push("Morning start time must be AM (12:00 AM – 11:59 AM).");
    if (m.end && !isAM(m.end))
      errors.push("Morning end time must be AM (12:00 AM – 11:59 AM).");
    if (m.timeout && !isAM(m.timeout))
      errors.push("Morning timeout must be AM (12:00 AM – 11:59 AM).");
    if (m.start && m.end) {
      if (parseTimeToMinutes(m.start) >= parseTimeToMinutes(m.end))
        errors.push("Morning start time must be earlier than end time.");
    }
    if (m.start && m.end && m.timeout) {
      const mS = parseTimeToMinutes(m.start);
      const mE = parseTimeToMinutes(m.end);
      const mT = parseTimeToMinutes(m.timeout);
      if (mT <= mS || mT > mE)
        errors.push("Morning timeout must be within the session start and end times.");
    }
  }

  // ── Afternoon: all PM ─────────────────────────────────────────────────────
  const a = this.afternoonAttendance;
  if (a) {
    if (a.start && !isPM(a.start))
      errors.push("Afternoon start time must be PM (12:00 PM – 11:59 PM).");
    if (a.end && !isPM(a.end))
      errors.push("Afternoon end time must be PM (12:00 PM – 11:59 PM).");
    if (a.timeout && !isPM(a.timeout))
      errors.push("Afternoon timeout must be PM (12:00 PM – 11:59 PM).");
    if (a.start && a.end) {
      if (parseTimeToMinutes(a.start) >= parseTimeToMinutes(a.end))
        errors.push("Afternoon start time must be earlier than end time.");
    }
    if (a.start && a.end && a.timeout) {
      const aS = parseTimeToMinutes(a.start);
      const aE = parseTimeToMinutes(a.end);
      const aT = parseTimeToMinutes(a.timeout);
      if (aT <= aS || aT > aE)
        errors.push("Afternoon timeout must be within the session start and end times.");
    }
  }

  if (errors.length > 0) return next(new Error(errors.join(" | ")));
  next();
});

eventSchema.index({ startDate: 1 });
eventSchema.index({ participationType: 1 });

module.exports = mongoose.model("Event", eventSchema);