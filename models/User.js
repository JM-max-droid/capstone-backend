const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    // ─── ROLE ───────────────────────────────────────────────
    role: {
      type: String,
      enum: ["student", "ssc", "oss", "dean", "super", "graduate"],
      required: true,
      index: true,
    },

    // ─── ID NUMBER ──────────────────────────────────────────
    idNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    // ─── PERSONAL INFO ──────────────────────────────────────
    firstName:  { type: String, trim: true, required: true },
    middleName: { type: String, trim: true, default: "" },
    lastName:   { type: String, trim: true, required: true },
    age:        { type: Number, required: true },

    // ─── ACADEMIC INFO ──────────────────────────────────────
    course:    { type: String, trim: true, default: "", index: true },
    strand:    { type: String, trim: true, default: "", index: true },
    yearLevel: { type: String, trim: true, required: true, index: true },
    section:   { type: String, trim: true, required: true },

    // ─── ACADEMIC YEAR ──────────────────────────────────────
    // e.g. "2024-2025" — tracks which school year the student belongs to
    academicYear: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    // ─── STUDENT STATUS ─────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "graduated", "failed", "irregular", "dropped", "on_leave"],
      default: "active",
      index: true,
    },

    // ─── GRADUATION INFO ────────────────────────────────────
    graduationYear: {
      type: Number,
      default: null,
    },

    // ─── YEAR-END REMARKS ───────────────────────────────────
    // Optional per-student note (e.g. "Pending clearance", "Incomplete grades")
    yearEndRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── PROMOTION HISTORY ──────────────────────────────────
    // Full audit trail — every year-end action is recorded here
    promotionHistory: [
      {
        fromYear:      { type: String },   // "2024-2025"
        toYear:        { type: String },   // "2025-2026"
        fromYearLevel: { type: String },   // "1st Year"
        toYearLevel:   { type: String },   // "2nd Year"
        action: {
          type: String,
          enum: ["promoted", "graduated", "failed", "dropped", "irregular", "on_leave"],
        },
        remarks:     { type: String, default: "" },
        processedAt: { type: Date, default: Date.now },
        processedBy: { type: String, default: "system" }, // idNumber or "system"
      },
    ],

    // ─── SSC ────────────────────────────────────────────────
    sscPosition: { type: String, trim: true, default: "" },

    // ─── MEDIA ──────────────────────────────────────────────
    photoURL: { type: String, default: "" },
    qrCode:   { type: String, default: "" },

    // ─── AUTHENTICATION ─────────────────────────────────────
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String },

    // ─── EMAIL VERIFICATION ─────────────────────────────────
    isEmailVerified:        { type: Boolean, default: false },
    verificationToken:      { type: String },
    verificationTokenExpiry:{ type: Date },
  },
  { timestamps: true }
);

// ─── INDEXES ────────────────────────────────────────────────
UserSchema.index({ firstName: "text", lastName: "text" });
UserSchema.index({ email: 1 });
UserSchema.index({ academicYear: 1, status: 1 });
UserSchema.index({ status: 1, yearLevel: 1 });

// ─── PASSWORD HASHING ───────────────────────────────────────
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (this.password && this.password.startsWith("$2b$")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ─── COMPARE PASSWORD ───────────────────────────────────────
UserSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.password) return false;
  return bcrypt.compare(plainPassword, this.password);
};

// ─── VIRTUAL: FULL NAME ─────────────────────────────────────
UserSchema.virtual("fullName").get(function () {
  const mid = this.middleName ? `${this.middleName} ` : "";
  return `${this.firstName} ${mid}${this.lastName}`.trim();
});

module.exports = mongoose.model("User", UserSchema);