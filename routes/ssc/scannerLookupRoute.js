const express = require("express");
const router = express.Router();
const User = require("../../models/User");

console.log("✅ Loading Scanner Lookup routes...");

// ==========================================
// ✅ GET STUDENT BY ID NUMBER (for studentInfo.tsx)
// ==========================================
router.get("/:idNumber", async (req, res) => {
  try {
    let { idNumber } = req.params;
    
    console.log("📱 GET student lookup:", idNumber);
    
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
      console.log("Searched as number:", asNumber, "Found:", !!user);
    }

    // If not found, try as string
    if (!user) {
      user = await User.findOne({ idNumber, role: "student" })
        .select("-password -__v")
        .lean();
      console.log("Searched as string:", idNumber, "Found:", !!user);
    }

    if (!user) {
      console.log("❌ Student not found");
      return res.status(404).json({ error: "Student not found" });
    }

    console.log("✅ Student found:", user.firstName, user.lastName);
    res.status(200).json(user);
  } catch (err) {
    console.error("❌ GET scanner lookup error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ==========================================
// ✅ POST LOOKUP (for sscScanner.tsx QR scan)
// ==========================================
router.post("/", async (req, res) => {
  try {
    let { idNumber } = req.body;
    
    console.log("📱 POST scanner lookup:", idNumber);
    
    if (!idNumber) {
      return res.status(400).json({ error: "ID number required" });
    }

    idNumber = String(idNumber).trim();
    let user;

    const asNumber = Number(idNumber);
    if (!Number.isNaN(asNumber)) {
      user = await User.findOne({ idNumber: asNumber, role: "student" })
        .select("-password -__v")
        .lean();
      console.log("Searched as number:", asNumber, "Found:", !!user);
    }

    if (!user) {
      user = await User.findOne({ idNumber, role: "student" })
        .select("-password -__v")
        .lean();
      console.log("Searched as string:", idNumber, "Found:", !!user);
    }

    if (!user) {
      console.log("❌ Student not found");
      return res.status(404).json({ error: "Student not found" });
    }

    console.log("✅ Student found:", user.firstName, user.lastName);
    res.status(200).json({ message: "Student found", student: user });
  } catch (err) {
    console.error("❌ POST scanner lookup error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

console.log("✅ Scanner Lookup routes configured!");
console.log("   - GET  /:idNumber  (for student info page)");
console.log("   - POST /           (for QR scanner)");

module.exports = router;