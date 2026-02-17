const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    // 🔐 Role
    role: {
      type: String,
      enum: ["student", "ssc", "oss", "dean", "super"],
      required: true,
      index: true,
    },
    // 🆔 ID Number
    idNumber: { type: Number, required: true, unique: true, index: true },
    // 👤 Personal Info
    firstName: { type: String, trim: true, required: true },
    middleName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, required: true },
    age: { type: Number, required: true },
    // 🎓 Academic Info
    course: { type: String, trim: true, default: "", index: true },
    strand: { type: String, trim: true, default: "", index: true },
    yearLevel: { type: String, trim: true, required: true, index: true },
    section: { type: String, trim: true, required: true },
    // 🏅 SSC Position
    sscPosition: { type: String, trim: true, default: "" },
    // 🖼️ Media
    photoURL: { type: String, default: "" },
    qrCode: { type: String, default: "" },
    // 🔑 Authentication
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String },
  },
  { timestamps: true }
);

// 🔍 Indexes
UserSchema.index({ firstName: "text", lastName: "text" });
UserSchema.index({ email: 1 });

// ── PASSWORD HASHING BEFORE SAVE ──
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // only hash if password changed
  
  // ✅ FIX: Skip hashing if password is already a bcrypt hash
  // This prevents DOUBLE HASHING when registerRoute manually hashes then calls save()
  if (this.password && this.password.startsWith("$2b$")) return next();
  
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── METHOD TO COMPARE PASSWORD (optional for future login/reset)
UserSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.password) return false;
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);