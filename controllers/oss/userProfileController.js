const User = require("../../models/User");
const bcrypt = require("bcryptjs");

// ================= GET OSS USER BY ID NUMBER =================
// Using idNumber as identifier since it's unique
const getUserById = async (req, res) => {
  try {
    const { idNumber } = req.query;

    console.log("📌 getUserById called — idNumber:", idNumber);

    if (!idNumber) {
      return res.status(400).json({ error: "ID number is required" });
    }

    // Try as number first, then string
    let user = await User.findOne({
      idNumber: Number(idNumber),
      role: "oss"
    }).select("-password -__v").lean();

    if (!user) {
      user = await User.findOne({
        idNumber: String(idNumber),
        role: "oss"
      }).select("-password -__v").lean();
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ OSS user fetched:", user.email);
    res.status(200).json({ user });
  } catch (err) {
    console.error("❌ getUserById error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PROFILE INFO =================
// Uses idNumber as the stable identifier (email can change)
const updateProfileInfo = async (req, res) => {
  try {
    const { idNumber, firstName, middleName, lastName, newEmail } = req.body;

    console.log("📌 updateProfileInfo called — idNumber:", idNumber);

    if (!idNumber) {
      return res.status(400).json({ error: "ID number is required" });
    }

    const existingUser = await User.findOne({ idNumber: Number(idNumber) });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if newEmail is already taken by another user
    if (newEmail && newEmail.toLowerCase() !== existingUser.email?.toLowerCase()) {
      const emailTaken = await User.findOne({
        email: newEmail.toLowerCase().trim(),
        _id: { $ne: existingUser._id }
      });
      if (emailTaken) {
        return res.status(409).json({ error: "Email is already in use by another account" });
      }
    }

    const updatedFields = {};
    if (firstName)                updatedFields.firstName  = firstName.trim();
    if (middleName !== undefined) updatedFields.middleName = middleName.trim();
    if (lastName)                 updatedFields.lastName   = lastName.trim();
    if (newEmail)                 updatedFields.email      = newEmail.toLowerCase().trim();

    const updatedUser = await User.findByIdAndUpdate(
      existingUser._id,
      { $set: updatedFields },
      { new: true }
    ).select("-password -__v").lean();

    console.log("✅ Profile updated for idNumber:", idNumber);
    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (err) {
    console.error("❌ updateProfileInfo error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PASSWORD =================
const updatePassword = async (req, res) => {
  try {
    const { idNumber, currentPassword, newPassword } = req.body;

    console.log("📌 updatePassword called — idNumber:", idNumber);

    if (!idNumber || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(user._id, { $set: { password: hashedPassword } });

    console.log("✅ Password updated for idNumber:", idNumber);
    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ updatePassword error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PROFILE PICTURE =================
const updateProfilePicture = async (req, res) => {
  try {
    const { idNumber, photoURL } = req.body;

    console.log("📌 updateProfilePicture called — idNumber:", idNumber);

    if (!idNumber || !photoURL) {
      return res.status(400).json({ error: "ID number and photoURL are required" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { idNumber: Number(idNumber) },
      { $set: { photoURL } },
      { new: true }
    ).select("-password -__v").lean();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ Profile picture updated for idNumber:", idNumber);
    res.status(200).json({ message: "Profile picture updated successfully", user: updatedUser });
  } catch (err) {
    console.error("❌ updateProfilePicture error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getUserById,
  updateProfileInfo,
  updatePassword,
  updateProfilePicture,
};