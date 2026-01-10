const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sscId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },

    // 🌅 MORNING
    morningIn: String,
    morningOut: String,
    morningStatus: {
      type: String,
      enum: ["present", "late", "absent"],
      default: "absent",
    },

    // 🌇 AFTERNOON
    afternoonIn: String,
    afternoonOut: String,
    afternoonStatus: {
      type: String,
      enum: ["present", "late", "absent"],
      default: "absent",
    },
  },
  { timestamps: true }
);

// ONE row per student per event per date
AttendanceSchema.index(
  { studentId: 1, eventId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("Attendance", AttendanceSchema);
