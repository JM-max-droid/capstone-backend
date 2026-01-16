// models/User.js
const mongoose = require("mongoose");

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
    idNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    // 👤 Personal Info
    firstName: {
      type: String,
      trim: true,
      required: true,
    },
    middleName: {
      type: String,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      trim: true,
      required: true,
    },
    age: {
      type: Number,
      required: true,
    },

    // 🎓 Academic Info
    course: {
      type: String,
      trim: true,
      default: "", // College only
      index: true,
    },
    strand: {
      type: String,
      trim: true,
      default: "", // Senior High only
      index: true,
    },
    yearLevel: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    section: {
      type: String,
      trim: true,
      required: true,
    },

    // 🏅 SSC
    sscPosition: {
      type: String,
      trim: true,
      default: "",
    },

    // 🖼️ Media
    photoURL: {
      type: String,
      default: "",
    },
    qrCode: {
      type: String,
      default: "",
    },

    // 🔑 Login
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
    },

    // 📧 Email Verification
    verificationToken: String,
    verificationTokenExpiry: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🔍 Text search
UserSchema.index({ firstName: "text", lastName: "text" });

module.exports = mongoose.model("User", UserSchema);
