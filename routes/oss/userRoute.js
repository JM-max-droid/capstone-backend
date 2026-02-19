const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const {
  getUserById,
  updateProfileInfo,
  updatePassword,
  updateProfilePicture,
} = require("../../controllers/oss/userProfileController");

// ================================================================
// ⚠️  ORDER MATTERS — named routes FIRST, dynamic /:idNumber LAST
// ================================================================

// PUT  /api/users/update-info      → update name + email
router.put("/update-info", updateProfileInfo);

// PUT  /api/users/update-password  → change password
router.put("/update-password", updatePassword);

// PUT  /api/users/update-picture   → change profile photo
router.put("/update-picture", updateProfilePicture);

// GET  /api/users?idNumber=xxx     → fetch OSS user by idNumber
router.get("/", getUserById);

// GET  /api/users/:idNumber        → QR scan for students (MUST be last)
router.get("/:idNumber", async (req, res) => {
  try {
    let { idNumber } = req.params;
    idNumber = String(idNumber).trim();

    console.log("🔍 QR scan — idNumber:", idNumber);

    let user = null;

    const asNumber = Number(idNumber);
    if (!isNaN(asNumber) && isFinite(asNumber)) {
      user = await User.findOne({ idNumber: asNumber, role: "student" })
        .select("-password -__v")
        .lean();
    }

    if (!user) {
      user = await User.findOne({ idNumber: idNumber, role: "student" })
        .select("-password -__v")
        .lean();
    }

    if (!user) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("❌ QR scan error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;