const User = require("../../models/User");
const bcrypt = require("bcryptjs");

// ================= GET STUDENT USER BY ID NUMBER OR EMAIL =================
const getStudentUserById = async (req, res) => {
  try {
    const { idNumber, email } = req.query;

    console.log("📌 getStudentUserById called — idNumber:", idNumber, "| email:", email);

    // ✅ Must have at least one identifier
    if (!idNumber && !email) {
      return res.status(400).json({ error: "ID number or email is required" });
    }

    let user = null;

    // ─── Try by idNumber first ──────────────────────────────────────────────
    if (idNumber) {
      // Try as Number first (most common case)
      user = await User.findOne({
        idNumber: Number(idNumber),
        role: "student",
      }).select("-password -__v").lean();

      // Fallback: try as String if not found
      if (!user) {
        user = await User.findOne({
          idNumber: String(idNumber),
          role: "student",
        }).select("-password -__v").lean();
      }
    }

    // ─── Fallback: try by email ─────────────────────────────────────────────
    if (!user && email) {
      user = await User.findOne({
        email: email.toLowerCase().trim(),
        role: "student",
      }).select("-password -__v").lean();
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ Student fetched:", user.email);
    res.status(200).json({ user });
  } catch (err) {
    console.error("❌ getStudentUserById error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PASSWORD (STUDENT) =================
const updateStudentPassword = async (req, res) => {
  try {
    const { idNumber, currentPassword, newPassword } = req.body;

    console.log("📌 updateStudentPassword called — idNumber:", idNumber);

    // ─── Validate required fields ───────────────────────────────────────────
    if (!idNumber || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    // ─── Find the student ───────────────────────────────────────────────────
    let user = await User.findOne({ idNumber: Number(idNumber), role: "student" });

    // Fallback: try as String
    if (!user) {
      user = await User.findOne({ idNumber: String(idNumber), role: "student" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // ─── Verify current password ────────────────────────────────────────────
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // ─── Hash and save new password ─────────────────────────────────────────
    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(user._id, { $set: { password: hashedPassword } });

    console.log("✅ Student password updated for idNumber:", idNumber);
    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ updateStudentPassword error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getStudentUserById,
  updateStudentPassword,
};