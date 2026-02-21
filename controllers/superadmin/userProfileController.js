const User    = require("../../models/User");
const bcrypt  = require("bcryptjs");

// ================= GET SUPER ADMIN BY ID NUMBER OR EMAIL =================
const getUserById = async (req, res) => {
  try {
    const { idNumber, email } = req.query;

    if (!idNumber && !email) {
      return res.status(400).json({ error: "ID number or email is required" });
    }

    let user = null;

    if (idNumber) {
      user = await User.findOne({ idNumber: Number(idNumber), role: "super" })
        .select("-password -__v").lean();

      if (!user) {
        user = await User.findOne({ idNumber: String(idNumber), role: "super" })
          .select("-password -__v").lean();
      }
    }

    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim(), role: "super" })
        .select("-password -__v").lean();
    }

    if (!user) return res.status(404).json({ error: "Super admin not found" });

    res.status(200).json({ user });
  } catch (err) {
    console.error("❌ [Super] getUserById:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PROFILE INFO =================
const updateProfileInfo = async (req, res) => {
  try {
    const { idNumber, firstName, middleName, lastName, newEmail } = req.body;

    if (!idNumber) return res.status(400).json({ error: "ID number is required" });

    let existing = await User.findOne({ idNumber: Number(idNumber), role: "super" });
    if (!existing)
      existing = await User.findOne({ idNumber: String(idNumber), role: "super" });
    if (!existing) return res.status(404).json({ error: "Super admin not found" });

    if (newEmail && newEmail.toLowerCase() !== existing.email?.toLowerCase()) {
      const taken = await User.findOne({
        email: newEmail.toLowerCase().trim(),
        _id: { $ne: existing._id },
      });
      if (taken) return res.status(409).json({ error: "Email is already in use by another account" });
    }

    const fields = {};
    if (firstName)                fields.firstName  = firstName.trim();
    if (middleName !== undefined) fields.middleName = middleName.trim();
    if (lastName)                 fields.lastName   = lastName.trim();
    if (newEmail)                 fields.email      = newEmail.toLowerCase().trim();

    const updated = await User.findByIdAndUpdate(
      existing._id, { $set: fields }, { new: true }
    ).select("-password -__v").lean();

    res.status(200).json({ message: "Profile updated successfully", user: updated });
  } catch (err) {
    console.error("❌ [Super] updateProfileInfo:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PASSWORD =================
const updatePassword = async (req, res) => {
  try {
    const { idNumber, currentPassword, newPassword } = req.body;

    if (!idNumber || !currentPassword || !newPassword)
      return res.status(400).json({ error: "All fields are required" });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "New password must be at least 6 characters" });

    let user = await User.findOne({ idNumber: Number(idNumber), role: "super" });
    if (!user)
      user = await User.findOne({ idNumber: String(idNumber), role: "super" });
    if (!user) return res.status(404).json({ error: "Super admin not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await User.findByIdAndUpdate(user._id, { $set: { password: hashed } });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ [Super] updatePassword:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PROFILE PICTURE =================
const updateProfilePicture = async (req, res) => {
  try {
    const { idNumber, photoURL } = req.body;

    if (!idNumber || !photoURL)
      return res.status(400).json({ error: "ID number and photoURL are required" });

    let updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "super" },
      { $set: { photoURL } },
      { new: true }
    ).select("-password -__v").lean();

    if (!updated) {
      updated = await User.findOneAndUpdate(
        { idNumber: String(idNumber), role: "super" },
        { $set: { photoURL } },
        { new: true }
      ).select("-password -__v").lean();
    }

    if (!updated) return res.status(404).json({ error: "Super admin not found" });

    res.status(200).json({ message: "Profile picture updated successfully", user: updated });
  } catch (err) {
    console.error("❌ [Super] updateProfilePicture:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getUserById, updateProfileInfo, updatePassword, updateProfilePicture };