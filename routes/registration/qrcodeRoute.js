const express = require("express");
const router = express.Router();
const sanitize = require("mongo-sanitize");
const User = require("../../models/User");

// ─── Shared user projection ────────────────────────────────
// Returns all fields needed by the frontend for any role
const buildUserResponse = (user) => ({
  idNumber:    user.idNumber,
  role:        user.role,
  firstName:   user.firstName,
  middleName:  user.middleName,
  lastName:    user.lastName,
  age:         user.age,

  // College student fields
  course:      user.course    || null,
  yearLevel:   user.yearLevel || null,
  section:     user.section   || null,

  // SHS student field
  strand:      user.strand    || null,

  // SSC field
  sscPosition: user.sscPosition || null,

  // Media — only for non-OSS (but we return both; frontend decides what to show)
  photoURL:    user.photoURL  || null,
  qrCode:      user.qrCode    || null,

  // Auth info (safe to expose)
  email:       user.email     || null,
});

// ─── GET — fetch by idNumber or email (query params) ──────
router.get("/", async (req, res) => {
  try {
    console.log("📥 QR Code GET request received");

    let { idNumber, email } = req.query;

    if (!idNumber && !email) {
      return res.status(400).json({ error: "ID number or email is required" });
    }

    if (idNumber) idNumber = sanitize(idNumber);
    if (email)    email    = sanitize(email);

    const user = idNumber
      ? await User.findOne({ idNumber: Number(idNumber) })
      : await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User found:", user.idNumber, "| Role:", user.role);

    res.json({
      message: "QR code fetched successfully",
      qrCode:  user.qrCode || null,
      user:    buildUserResponse(user),
    });
  } catch (err) {
    console.error("🔥 Error fetching QR code:", err);
    res.status(500).json({ error: "Server error fetching QR code", details: err.message });
  }
});

// ─── POST — fetch by idNumber or email (body) ─────────────
router.post("/", async (req, res) => {
  try {
    console.log("📥 QR Code POST request received");

    let { idNumber, email } = req.body;

    if (!idNumber && !email) {
      return res.status(400).json({ error: "ID number or email is required" });
    }

    if (idNumber) idNumber = sanitize(idNumber);
    if (email)    email    = sanitize(email);

    const user = idNumber
      ? await User.findOne({ idNumber: Number(idNumber) })
      : await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User found:", user.idNumber, "| Role:", user.role);

    res.json({
      message: "User data fetched successfully",
      user:    buildUserResponse(user),
    });
  } catch (err) {
    console.error("🔥 Error fetching user:", err);
    res.status(500).json({ error: "Server error fetching user" });
  }
});

module.exports = router;