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
      default: "",
      index: true,
    },
    strand: {
      type: String,
      trim: true,
      default: "",
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

    // 🏅 SSC Position
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

    // 🔑 Authentication
    email: {
      type: String,
      unique: true,
      sparse: true, // allows null/undefined values
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
    },

    // ✅ EMAIL VERIFICATION FIELDS (NEW!)
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      default: null,
    },
    verificationTokenExpiry: {
      type: Date,
      default: null,
    },
  },
  { 
    timestamps: true // adds createdAt and updatedAt
  }
);

// 🔍 Text search index
UserSchema.index({ firstName: "text", lastName: "text" });

// 📧 Email index for faster lookups
UserSchema.index({ email: 1 });

module.exports = mongoose.model("User", UserSchema);