const mongoose = require("mongoose");

const academicYearSchema = new mongoose.Schema(
  {
    year: {
      type: String, // "2025-2026"
      required: true,
      unique: true,
      trim: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
      index: true,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    // Summary stats saved after year-end process
    summary: {
      totalPromoted:  { type: Number, default: 0 },
      totalGraduated: { type: Number, default: 0 },
      totalFailed:    { type: Number, default: 0 },
      totalDropped:   { type: Number, default: 0 },
      totalIrregular: { type: Number, default: 0 },
      processedAt:    { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AcademicYear", academicYearSchema);