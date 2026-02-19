const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const {
  getUserByEmail,
  updateProfileInfo,
  updatePassword,
  updateProfilePicture,
} = require("../../controllers/oss/userProfileController");

// ================= GET USER BY EMAIL (for OSS profile) =================
router.get("/", getUserByEmail);

// ================= UPDATE PROFILE INFO (name + email) =================
router.put("/update-info", updateProfileInfo);

// ================= UPDATE PASSWORD =================
router.put("/update-password", updatePassword);

// ================= UPDATE PROFILE PICTURE =================
router.put("/update-picture", updateProfilePicture);

// ================= GET USER BY ID NUMBER (for QR scan) =================
router.get("/:idNumber", async (req, res) => {
  try {
    let { idNumber } = req.params;

    console.log("🔍 GET /api/users/:idNumber - Looking up student:", idNumber);

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
      console.log("   Searched as number:", asNumber, "Found:", !!user);
    }

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

module.exports = router;