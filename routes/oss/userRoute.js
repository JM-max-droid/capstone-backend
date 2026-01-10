const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// ================= GET USER BY ID NUMBER =================
// This is for fetching student details after QR scan
router.get("/:idNumber", async (req, res) => {
  try {
    let { idNumber } = req.params;
    
    console.log("🔍 GET /api/users/:idNumber - Looking up student:", idNumber);
    
    if (!idNumber) {
      return res.status(400).json({ error: "ID number required" });
    }

    idNumber = String(idNumber).trim();
    let user;

    // Try as number first
    const asNumber = Number(idNumber);
    if (!Number.isNaN(asNumber)) {
      user = await User.findOne({ idNumber: asNumber, role: "student" })
        .select("-password -__v")
        .lean();
      console.log("   Searched as number:", asNumber, "Found:", !!user);
    }

    // If not found, try as string
    if (!user) {
      user = await User.findOne({ idNumber, role: "student" })
        .select("-password -__v")
        .lean();
      console.log("   Searched as string:", idNumber, "Found:", !!user);
    }

    if (!user) {
      console.log("❌ Student not found");
      return res.status(404).json({ error: "Student not found" });
    }

    console.log("✅ Student found:", user.firstName, user.lastName);
    res.status(200).json(user);
  } catch (err) {
    console.error("❌ GET user by ID error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= GET ALL USERS (optional) =================
router.get("/", async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select("-password -__v")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(users);
  } catch (err) {
    console.error("❌ GET all users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;