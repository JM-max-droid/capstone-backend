const express = require("express");
const QRCode = require("qrcode");
const User = require("../../models/User");

const router = express.Router();

/**
 * =========================
 * ✅ Get QR code by EMAIL or ID NUMBER
 * =========================
 * GET /api/user/qrcode?email=test@mail.com
 * GET /api/user/qrcode?idNumber=93
 * 
 * ⚠️ MUST BE BEFORE /:idNumber route!
 */
router.get("/qrcode", async (req, res) => {
  try {
    console.log("📥 QR Code GET request received");
    console.log("Query params:", req.query);
    
    const { email, idNumber } = req.query;
    
    if (!email && !idNumber) {
      console.log("❌ No email or ID number provided");
      return res.status(400).json({ error: "Email or ID number is required" });
    }

    let user;

    // Search by idNumber first (preferred), then by email
    if (idNumber) {
      console.log("🔍 Looking for user with ID number:", idNumber);
      user = await User.findOne({ idNumber: Number(idNumber) }).lean();
    } else if (email) {
      console.log("🔍 Looking for user with email:", email);
      user = await User.findOne({ email }).lean();
    }

    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User found:", user.idNumber);

    // Generate QR if missing
    if (!user.qrCode) {
      console.log("⚠️ QR code missing, generating new one...");
      const qrData = JSON.stringify({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        idNumber: user.idNumber || "N/A",
      });

      const qrCodeImage = await QRCode.toDataURL(qrData);
      await User.updateOne({ _id: user._id }, { qrCode: qrCodeImage });
      user.qrCode = qrCodeImage;
      console.log("✅ QR code generated and saved");
    } else {
      console.log("✅ QR code exists in database");
    }

    res.status(200).json({ 
      qrCode: user.qrCode,
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
      }
    });
  } catch (err) {
    console.error("❌ Error fetching QR code:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * =========================
 * ✅ Get user by EMAIL (query)
 * =========================
 * GET /api/user?email=test@mail.com
 */
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    let user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Generate QR if missing
    if (!user.qrCode) {
      const qrData = JSON.stringify({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        idNumber: user.idNumber || "N/A",
      });

      const qrCodeImage = await QRCode.toDataURL(qrData);
      await User.updateOne({ _id: user._id }, { qrCode: qrCodeImage });
      user.qrCode = qrCodeImage;
    }

    res.status(200).json({ 
      message: "User fetched successfully",
      user: user 
    });
  } catch (err) {
    console.error("❌ Error fetching user by email:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * =========================
 * ✅ Get user by ID NUMBER (param)
 * =========================
 * GET /api/user/12345
 * 
 * ⚠️ MUST BE AFTER /qrcode route!
 */
router.get("/:idNumber", async (req, res) => {
  try {
    const idNumber = Number(req.params.idNumber);
    if (!idNumber) {
      return res.status(400).json({ error: "Invalid ID number" });
    }

    let user = await User.findOne({ idNumber }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Generate QR if missing
    if (!user.qrCode) {
      const qrData = JSON.stringify({
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        idNumber: user.idNumber || "N/A",
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

/**
 * =========================
 * ✅ Update user info by EMAIL
 * =========================
 * PUT /api/user/update?email=test@mail.com
 */
router.put("/update", async (req, res) => {
  try {
    const { email } = req.query;
    const updates = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOneAndUpdate(
      { email },
      updates,
      { new: true }
    ).lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ message: "✅ User updated", user });
  } catch (err) {
    console.error("❌ Error updating user:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;