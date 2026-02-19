const express = require("express");
const router  = express.Router();
const QRCode  = require("qrcode");
const User    = require("../../models/User");
const {
  getStudentUserById,
  updateStudentPassword,
} = require("../../controllers/student/userProfileController");

// ================================================================
// ⚠️  Named/specific routes FIRST — dynamic /:idNumber LAST
// ================================================================

// PUT  /api/student-user/update-password  → change password
router.put("/update-password", updateStudentPassword);

// GET  /api/student-user?idNumber=xxx     → fetch student profile
router.get("/", getStudentUserById);

// ── Keep all existing routes below ──────────────────────────────

// GET  /api/student-user/qrcode?email=xxx or ?idNumber=xxx
router.get("/qrcode", async (req, res) => {
  try {
    const { email, idNumber } = req.query;
    if (!email && !idNumber) {
      return res.status(400).json({ error: "Email or ID number is required" });
    }

    let user;
    if (idNumber) {
      user = await User.findOne({ idNumber: Number(idNumber) }).lean();
    } else if (email) {
      user = await User.findOne({ email }).lean();
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.qrCode) {
      const qrData     = JSON.stringify({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        idNumber: user.idNumber || "N/A",
      });
      const qrCodeImage = await QRCode.toDataURL(qrData);
      await User.updateOne({ _id: user._id }, { qrCode: qrCodeImage });
      user.qrCode = qrCodeImage;
    }

    res.status(200).json({
      qrCode: user.qrCode,
      user: {
        idNumber: user.idNumber, role: user.role,
        firstName: user.firstName, middleName: user.middleName, lastName: user.lastName,
        age: user.age, course: user.course, yearLevel: user.yearLevel,
        section: user.section, photoURL: user.photoURL, email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching QR code:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT  /api/student-user/update?email=xxx
router.put("/update", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOneAndUpdate({ email }, req.body, { new: true }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ message: "✅ User updated", user });
  } catch (err) {
    console.error("❌ Error updating user:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET  /api/student-user/:idNumber  → get by ID (MUST be last)
router.get("/:idNumber", async (req, res) => {
  try {
    const idNumber = Number(req.params.idNumber);
    if (!idNumber) return res.status(400).json({ error: "Invalid ID number" });

    let user = await User.findOne({ idNumber }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.qrCode) {
      const qrData     = JSON.stringify({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email, idNumber: user.idNumber || "N/A",
      });
      const qrCodeImage = await QRCode.toDataURL(qrData);
      await User.updateOne({ _id: user._id }, { qrCode: qrCodeImage });
      user.qrCode = qrCodeImage;
    }

    res.status(200).json({ student: user });
  } catch (err) {
    console.error("❌ Error fetching user by ID:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;