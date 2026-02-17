const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

// ✅ POST REGISTRATION (WITHOUT EMAIL VERIFICATION)
router.post("/", async (req, res) => {
  console.log("\n🔵 ========== REGISTRATION REQUEST ==========");
  console.log("📧 Request body:", {
    idNumber: req.body.idNumber,
    email: req.body.email,
    hasPassword: !!req.body.password,
  });

  try {
    const { idNumber, email, password, photoURL, qrCode } = req.body;

    // Validation
    if (!idNumber || !email || !password) {
      console.log("❌ Validation failed: Missing required fields");
      return res.status(400).json({ 
        error: "ID, email, and password are required" 
      });
    }

    // Find user by ID
    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) {
      console.log("❌ User not found with ID:", idNumber);
      return res.status(404).json({ 
        error: "User not found with that ID" 
      });
    }

    console.log("✅ User found:", user.firstName, user.lastName);

    // Check if already registered (has BOTH email AND password)
    if (user.email && user.password) {
      console.log("❌ User already registered");
      return res.status(400).json({ 
        error: "This user is already registered" 
      });
    }

    // Check if email is already used by another user
    const existingEmail = await User.findOne({ 
      email: email.trim().toLowerCase(),
      _id: { $ne: user._id }
    });
    if (existingEmail) {
      console.log("❌ Email already in use by another account");
      return res.status(400).json({ 
        error: "This email is already registered to another account" 
      });
    }

    // ✅ FIX: Hash password HERE manually
    // Then use updateOne to BYPASS the pre-save hook in User model
    // This prevents DOUBLE HASHING if your User model has a pre-save hook
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("✅ Password hashed successfully");

    // ✅ FIX: Use updateOne instead of user.save()
    // This bypasses any pre-save middleware that might re-hash the password!
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          ...(photoURL && { photoURL }),
          ...(qrCode && { qrCode }),
        }
      }
    );
    console.log("✅ User data saved to database (via updateOne - no pre-save hook triggered)");

    // Fetch updated user to return correct info
    const updatedUser = await User.findById(user._id);

    // ✅ SUCCESS RESPONSE
    const userInfo = {
      idNumber: updatedUser.idNumber,
      firstName: updatedUser.firstName,
      middleName: updatedUser.middleName,
      lastName: updatedUser.lastName,
      age: updatedUser.age,
      course: updatedUser.course,
      strand: updatedUser.strand,
      yearLevel: updatedUser.yearLevel,
      section: updatedUser.section,
      sscPosition: updatedUser.sscPosition,
      email: updatedUser.email,
      photoURL: updatedUser.photoURL || null,
      qrCode: updatedUser.qrCode || null,
      role: updatedUser.role,
    };

    console.log("✅ Registration successful for:", updatedUser.email);
    console.log("🔵 ========================================\n");

    res.status(200).json({
      success: true,
      message: "✅ Registration successful! You can now login.",
      user: userInfo,
    });

  } catch (err) {
    console.error("\n🔥 ========== REGISTRATION ERROR ==========");
    console.error("Error:", err);
    console.error("Stack:", err.stack);
    console.error("==========================================\n");
    
    res.status(500).json({ 
      error: "Server error during registration",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;