const User = require("../../models/User");
const bcrypt = require("bcryptjs");

// ================= GET USER BY EMAIL =================
const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("-password -__v") // ✅ Never return hashed password to client
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User fetched:", user.email);
    res.status(200).json({ user });
  } catch (err) {
    console.error("❌ getUserByEmail error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PROFILE INFO =================
// Updates: firstName, middleName, lastName, email
const updateProfileInfo = async (req, res) => {
  try {
    const { currentEmail, firstName, middleName, lastName, newEmail } = req.body;

    if (!currentEmail) {
      return res.status(400).json({ error: "Current email is required" });
    }

    const existingUser = await User.findOne({ email: currentEmail.toLowerCase().trim() });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if newEmail is already taken by another user
    if (newEmail && newEmail.toLowerCase() !== currentEmail.toLowerCase()) {
      const emailTaken = await User.findOne({ email: newEmail.toLowerCase().trim() });
      if (emailTaken) {
        return res.status(409).json({ error: "Email is already in use by another account" });
      }
    }

    const updatedFields = {};
    if (firstName) updatedFields.firstName = firstName.trim();
    if (middleName !== undefined) updatedFields.middleName = middleName.trim();
    if (lastName) updatedFields.lastName = lastName.trim();
    if (newEmail) updatedFields.email = newEmail.toLowerCase().trim();

    const updatedUser = await User.findByIdAndUpdate(
      existingUser._id,
      { $set: updatedFields },
      { new: true }
    )
      .select("-password -__v")
      .lean();

    console.log("✅ Profile info updated for:", updatedUser.email);
    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (err) {
    console.error("❌ updateProfileInfo error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PASSWORD =================
const updatePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Email, current password, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    // Must fetch WITH password field for comparison
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(user._id, { $set: { password: hashedPassword } });

    console.log("✅ Password updated for:", user.email);
    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ updatePassword error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ================= UPDATE PROFILE PICTURE =================
// Accepts base64 string or URL (adjust to your storage solution)
const updateProfilePicture = async (req, res) => {
  try {
    const { email, photoURL } = req.body;

    if (!email || !photoURL) {
      return res.status(400).json({ error: "Email and photoURL are required" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: { photoURL } },
      { new: true }
    )
      .select("-password -__v")
      .lean();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ Profile picture updated for:", updatedUser.email);
    res.status(200).json({ message: "Profile picture updated successfully", user: updatedUser });
  } catch (err) {
    console.error("❌ updateProfilePicture error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getUserByEmail,
  updateProfileInfo,
  updatePassword,
  updateProfilePicture,
};