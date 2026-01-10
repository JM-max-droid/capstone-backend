const mongoose = require("mongoose");

const attendanceTimeSchema = new mongoose.Schema(
  {
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
    allottedTime: {
      type: Number,
      required: true, // ❗ required
    },
    timeout: {
      type: String,
      required: true, // ❗ REQUIRED TALAGA
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    morningAttendance: {
      type: attendanceTimeSchema,
      required: true,
    },

    afternoonAttendance: {
      type: attendanceTimeSchema,
      required: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    fines: {
      type: Number,
      default: 0,
    },

    image: {
      type: String,
      default: "",
    },

    createdBy: {
      type: String,
      default: "OSS Admin",
    },

    participationType: {
      type: String,
      enum: ["ALL", "FAMILY"],
      required: true,
      default: "ALL",
    },

    families: {
      type: [Number],
      default: [],
      validate: {
        validator: function (arr) {
          if (this.participationType === "FAMILY") {
            return arr.length > 0 && arr.every(n => n >= 1 && n <= 12);
          }
          return true;
        },
        message:
          "Family numbers must be between 1 and 12 and cannot be empty",
      },
    },
  },
  { timestamps: true }
);

// indexes
eventSchema.index({ startDate: 1 });
eventSchema.index({ participationType: 1 });

module.exports = mongoose.model("Event", eventSchema);
