const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

const router = express.Router();

// ─── VALIDATION HELPERS ─────────────────────────────────────────────────────
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateIdNumber = (idNumber) => {
  return /^\d+$/.test(String(idNumber));
};

const validateAge = (age) => {
  const ageNum = parseInt(age);
  return !isNaN(ageNum) && ageNum >= 1 && ageNum <= 120;
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

// ─── GET all users ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const skip = (page - 1) * limit;

    const users = await User.find({})
      .select("-password -qrCode")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments();

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── CREATE new user ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      idNumber,
      firstName,
      middleName,
      lastName,
      age,
      course,
      strand,
      yearLevel,
      section,
      email,
      password,
      role,
      sscPosition,
    } = req.body;

    // ──────────────────────────────────────────────────────────────────────
    // 1️⃣ VALIDATE REQUIRED FIELDS
    // ──────────────────────────────────────────────────────────────────────
    if (!idNumber || !firstName || !lastName || !age || !role) {
      return res.status(400).json({
        error: "Missing required fields: idNumber, firstName, lastName, age, role",
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 2️⃣ VALIDATE ID NUMBER FORMAT
    // ──────────────────────────────────────────────────────────────────────
    if (!validateIdNumber(idNumber)) {
      return res.status(400).json({
        error: "ID Number must contain only digits",
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 3️⃣ VALIDATE AGE RANGE
    // ──────────────────────────────────────────────────────────────────────
    if (!validateAge(age)) {
      return res.status(400).json({
        error: "Age must be between 1 and 120",
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 4️⃣ VALIDATE EMAIL FORMAT (if provided)
    // ──────────────────────────────────────────────────────────────────────
    if (email && !validateEmail(email)) {
      return res.status(400).json({
        error: "Please provide a valid email address",
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 5️⃣ VALIDATE PASSWORD STRENGTH (if provided)
    // ──────────────────────────────────────────────────────────────────────
    if (password && !validatePassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 6️⃣ CHECK IF USER WITH ID NUMBER ALREADY EXISTS
    // ──────────────────────────────────────────────────────────────────────
    const existingUser = await User.findOne({ idNumber: parseInt(idNumber) });
    if (existingUser) {
      return res.status(400).json({
        error: "User with this ID number already exists",
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 7️⃣ CHECK IF EMAIL ALREADY EXISTS (if provided)
    // ──────────────────────────────────────────────────────────────────────
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingEmail) {
        return res.status(400).json({
          error: "User with this email already exists",
        });
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 8️⃣ VALIDATE ROLE
    // ──────────────────────────────────────────────────────────────────────
    const validRoles = ["student", "ssc", "oss", "super"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 9️⃣ BUILD USER DATA OBJECT
    // ──────────────────────────────────────────────────────────────────────
    const userData = {
      idNumber: parseInt(idNumber),
      firstName: firstName.trim(),
      middleName: middleName ? middleName.trim() : "",
      lastName: lastName.trim(),
      age: parseInt(age),
      role,
      yearLevel: "",
      section: "",
    };

    // ──────────────────────────────────────────────────────────────────────
    // 🔟 ADD ROLE-SPECIFIC FIELDS
    // ──────────────────────────────────────────────────────────────────────
    
    // STUDENT ROLE
    if (role === "student") {
      if (!yearLevel || !section) {
        return res.status(400).json({
          error: "Students require yearLevel and section",
        });
      }
      userData.yearLevel = yearLevel.trim();
      userData.section = section.trim();
      userData.course = course ? course.trim() : "";
      userData.strand = strand ? strand.trim() : "";
    }

    // SSC ROLE - Requires same fields as student + sscPosition
    if (role === "ssc") {
      if (!yearLevel || !section) {
        return res.status(400).json({
          error: "SSC members require yearLevel and section",
        });
      }
      userData.yearLevel = yearLevel.trim();
      userData.section = section.trim();
      userData.course = course ? course.trim() : "";
      userData.strand = strand ? strand.trim() : "";
      userData.sscPosition = sscPosition ? sscPosition.trim() : "";
    }

    // OSS ROLE - Only needs basic info
    if (role === "oss") {
      userData.yearLevel = "N/A";
      userData.section = "N/A";
    }

    // SUPER ADMIN ROLE - Only needs basic info
    if (role === "super") {
      userData.yearLevel = "N/A";
      userData.section = "N/A";
    }

    // ──────────────────────────────────────────────────────────────────────
    // 1️⃣1️⃣ ADD OPTIONAL AUTHENTICATION FIELDS
    // ──────────────────────────────────────────────────────────────────────
    if (email) userData.email = email.trim().toLowerCase();
    if (password) userData.password = password; // Will be hashed by pre-save hook

    // ──────────────────────────────────────────────────────────────────────
    // 1️⃣2️⃣ CREATE AND SAVE USER
    // ──────────────────────────────────────────────────────────────────────
    const newUser = new User(userData);
    await newUser.save();

    // ──────────────────────────────────────────────────────────────────────
    // 1️⃣3️⃣ RETURN USER WITHOUT SENSITIVE DATA
    // ──────────────────────────────────────────────────────────────────────
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.qrCode;

    res.status(201).json({
      message: "User created successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("Error creating user:", err);

    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `A user with this ${field} already exists`,
      });
    }

    // Handle validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        error: messages.join(", "),
      });
    }

    res.status(500).json({ error: "Failed to create user" });
  }
});

// ─── UPDATE user info ───────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const updates = { ...req.body };

    // Remove fields that shouldn't be updated directly
    delete updates.password;
    delete updates.idNumber; // ID number should not be changed
    delete updates.role; // Role should not be changed via this route
    delete updates.qrCode;

    // Validate email if being updated
    if (updates.email && !validateEmail(updates.email)) {
      return res.status(400).json({
        error: "Please provide a valid email address",
      });
    }

    // Validate age if being updated
    if (updates.age && !validateAge(updates.age)) {
      return res.status(400).json({
        error: "Age must be between 1 and 120",
      });
    }

    // Trim string fields
    Object.keys(updates).forEach((key) => {
      if (typeof updates[key] === "string") {
        updates[key] = updates[key].trim();
      }
    });

    // Convert numeric fields
    if (updates.age) updates.age = parseInt(updates.age);
    if (updates.email) updates.email = updates.email.toLowerCase();

    // Check for duplicate email
    if (updates.email) {
      const existingEmail = await User.findOne({
        email: updates.email,
        _id: { $ne: req.params.id },
      });
      if (existingEmail) {
        return res.status(400).json({
          error: "A user with this email already exists",
        });
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password -qrCode");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User updated successfully", user });
  } catch (err) {
    console.error("Error updating user:", err);

    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `A user with this ${field} already exists`,
      });
    }

    // Handle validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        error: messages.join(", "),
      });
    }

    res.status(500).json({ error: "Failed to update user" });
  }
});

// ─── RESET password ─────────────────────────────────────────────────────────
router.put("/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length === 0) {
      return res.status(400).json({ error: "New password is required" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Find user and use save() to trigger pre-save hook
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.password = newPassword;
    await user.save(); // This will trigger the pre-save hook to hash the password

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ─── DELETE user ────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User deleted successfully",
      deletedUser: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        idNumber: user.idNumber,
      },
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ─── GET user by ID ─────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -qrCode")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─── GET users by role ──────────────────────────────────────────────────────
router.get("/role/:role", async (req, res) => {
  try {
    const { role } = req.params;
    const validRoles = ["student", "ssc", "oss", "super"];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const users = await User.find({ role })
      .select("-password -qrCode")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      role,
      count: users.length,
      users,
    });
  } catch (err) {
    console.error("Error fetching users by role:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── GET user statistics ────────────────────────────────────────────────────
router.get("/stats/overview", async (req, res) => {
  try {
    const [
      totalUsers,
      students,
      sscMembers,
      ossStaff,
      registeredUsers,
      collegeStudents,
      seniorHighStudents,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "ssc" }),
      User.countDocuments({ role: "oss" }),
      User.countDocuments({ email: { $exists: true, $ne: "" } }),
      User.countDocuments({
        role: "student",
        course: { $exists: true, $ne: "" },
      }),
      User.countDocuments({
        role: "student",
        strand: { $exists: true, $ne: "" },
      }),
    ]);

    res.json({
      totalUsers,
      byRole: {
        students,
        sscMembers,
        ossStaff,
      },
      registeredUsers,
      pendingUsers: totalUsers - registeredUsers,
      studentBreakdown: {
        college: collegeStudents,
        seniorHigh: seniorHighStudents,
      },
    });
  } catch (err) {
    console.error("Error fetching statistics:", err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

module.exports = router;