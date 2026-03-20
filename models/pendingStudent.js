// models/PendingStudent.js
const mongoose = require("mongoose");

const PendingStudentSchema = new mongoose.Schema(
  {
    // ── Submitted data ───────────────────────────────────────
    idNumber:    { type: Number, required: true },
    firstName:   { type: String, required: true, trim: true },
    middleName:  { type: String, default: "", trim: true },
    lastName:    { type: String, required: true, trim: true },
    age:         { type: Number, required: true },
    course:      { type: String, default: "", trim: true },
    strand:      { type: String, default: "", trim: true },
    yearLevel:   { type: String, required: true, trim: true },
    section:     { type: String, required: true, trim: true },
    email:       { type: String, default: "", trim: true, lowercase: true },
    password:    { type: String, default: "" }, // plain-text kept until approved, then hashed

    // ── Meta ─────────────────────────────────────────────────
    submittedBy: { type: String, default: "ssc" },  // who submitted (e.g. sscPosition or name)
    status:      { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingStudent", PendingStudentSchema);