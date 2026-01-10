const express = require("express");
const router = express.Router();
const sharp = require("sharp");
const QRCode = require("qrcode");
const sanitize = require("mongo-sanitize");
const User = require("../../models/User");

router.post("/", async (req, res) => {
  try {
    let { idNumber, photoURL } = req.body;

    // Sanitize inputs
    idNumber = sanitize(idNumber);
    photoURL = sanitize(photoURL);

    if (!idNumber || !photoURL) {
      return res.status(400).json({ error: "ID number and photoURL are required" });
    }

    // Find user
    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Compress photo
    const base64Data = photoURL.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");
    const compressedBuffer = await sharp(imgBuffer)
      .resize({ width: 400 })
      .jpeg({ quality: 60 })
      .toBuffer();

    user.photoURL = `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`;

    // Generate QR code
    const qrPayload = { idNumber: user.idNumber, role: user.role };
    user.qrCode = await QRCode.toDataURL(JSON.stringify(qrPayload));

    await user.save();

    res.json({
      message: "Photo saved & QR code generated successfully",
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
      },
    });
  } catch (err) {
    console.error("🔥 Error saving photo or QR:", err);
    res.status(500).json({ error: "Server error while saving photo/QR" });
  }
});

module.exports = router;
