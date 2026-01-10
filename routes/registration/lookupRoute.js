const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const sanitize = require("mongo-sanitize");
const User = require("../../models/User");

// ⚡ Limit requests per IP to prevent overload
const lookupLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5,
  message: { error: "Too many requests. Please try again shortly." },
});

router.post("/", lookupLimiter, async (req, res) => {
  try {
    let { idNumber } = req.body;
    idNumber = sanitize(idNumber);

    if (!idNumber) {
      return res.status(400).json({ error: "ID number is required" });
    }

    // Normalize to string for search
    const normalized = String(idNumber).trim();

    // Use indexed field + lean for faster concurrent access
    const user = await User.findOne({
      $or: [{ idNumber: Number(normalized) }, { idNumber: normalized }],
    })
      .select("-__v")
      .hint({ idNumber: 1 }) // helps Mongo optimize
      .lean();

    if (!user) {
      return res.status(404).json({ error: "ID not found" });
    }

    // ✅ Check if already registered (has email and password)
    const isRegistered = !!(user.email && user.password);

    // ✅ Remove sensitive data before sending
    const { password, ...safeUser } = user;

    res.status(200).json({
      message: "User found successfully",
      student: safeUser,
      isRegistered: isRegistered, // ✅ Add registration status
    });
  } catch (err) {
    console.error("❌ Lookup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;