const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const {
  getUserByEmail,
  updateProfileInfo,
  updatePassword,
  updateProfilePicture,
} = require("../../controllers/oss/userProfileController");

// ================================================================
// ⚠️  ORDER MATTERS — specific routes MUST come before /:idNumber
// ================================================================

// ── Profile routes (OSS) ─────────────────────────────────────────
// GET  /api/users?email=xxx        → fetch OSS user by email
router.get("/profile", getUserByEmail);

// PUT  /api/users/update-info      → update name + email
router.put("/update-info", updateProfileInfo);

// PUT  /api/users/update-password  → change password
router.put("/update-password", updatePassword);

// PUT  /api/users/update-picture   → change profile photo
router.put("/update-picture", updateProfilePicture);

// ── Fallback GET by email (query param) ──────────────────────────
// This handles GET /api/users?email=xxx
router.get("/", getUserByEmail);

// ── QR scan — MUST be last so it doesn't swallow the routes above ─
// GET  /api/users/:idNumber        → fetch student by ID (QR)
router.get("/:idNumber", async (req, res) => {
  try {
    let { idNumber } = req.params;

    // Guard: reject if it looks like one of our named routes
    const reserved = ["profile", "update-info", "update-password", "update-picture"];
    if (reserved.includes(idNumber)) {
      return res.status(405).json({ error: "Method not allowed on this endpoint" });
    }

    console.log("🔍 GET /api/users/:idNumber - Looking up student:", idNumber);

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