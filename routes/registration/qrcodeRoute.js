const express = require("express");
const router = express.Router();
const sanitize = require("mongo-sanitize");
const User = require("../../models/User");

// GET route to fetch QR code by ID number or email
router.get("/", async (req, res) => {
  try {
    console.log("📥 QR Code GET request received");
    console.log("Query params:", req.query);
    
    let { idNumber, email } = req.query;
    
    // Check if at least one parameter is provided
    if (!idNumber && !email) {
      console.log("❌ No ID number or email provided");
      return res.status(400).json({ error: "ID number or email is required" });
    }

    // Sanitize inputs
    if (idNumber) idNumber = sanitize(idNumber);
    if (email) email = sanitize(email);

    let user;

    // Search by idNumber first (preferred), then by email
    if (idNumber) {
      console.log("🔍 Looking for user with ID number:", idNumber);
      user = await User.findOne({ idNumber: Number(idNumber) });
    } else if (email) {
      console.log("🔍 Looking for user with email:", email);
      user = await User.findOne({ email: email });
    }
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User found:", user.idNumber);
    console.log("✅ QR Code exists:", !!user.qrCode);

    res.json({
      message: "QR code fetched successfully",
      qrCode: user.qrCode || null,
      user: {
        idNumber: user.idNumber,
        role: user.role,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        age: user.age,
        course: user.course,
        yearLevel: user.yearLevel,
        section: user.section,
        photoURL: user.photoURL,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("🔥 Error fetching QR code:", err);
    res.status(500).json({ 
      error: "Server error fetching QR code",
      details: err.message 
    });
  }
});

// POST route to fetch user data by ID number (for scanning)
router.post("/", async (req, res) => {
  try {
    console.log("📥 QR Code POST request received");
    let { idNumber, email } = req.body;

    // Check if at least one parameter is provided
    if (!idNumber && !email) {
      return res.status(400).json({ error: "ID number or email is required" });
    }

    // Sanitize inputs
    if (idNumber) idNumber = sanitize(idNumber);
    if (email) email = sanitize(email);

    let user;

    // Search by idNumber first (preferred), then by email
    if (idNumber) {
      user = await User.findOne({ idNumber: Number(idNumber) });
    } else if (email) {
      user = await User.findOne({ email: email });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User data fetched successfully",
      user: {
        idNumber: user.idNumber,
        role: user.role,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        age: user.age,
        course: user.course,
        yearLevel: user.yearLevel,
        section: user.section,
        photoURL: user.photoURL,
        qrCode: user.qrCode,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("🔥 Error fetching user:", err);
    res.status(500).json({ error: "Server error fetching user" });
  }
});

module.exports = router;