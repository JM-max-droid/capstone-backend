const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

const router = express.Router();

// ─── GET all users ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password -qrCode")
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (err) {
    console.error(err);
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

    // Validate required fields
    if (!idNumber || !firstName || !lastName || !age || !role) {
      return res.status(400).json({ 
        error: "Missing required fields: idNumber, firstName, lastName, age, role" 
      });
    }

    // Check if user with ID number already exists
    const existingUser = await User.findOne({ idNumber });
    if (existingUser) {
      return res.status(400).json({ 
        error: "User with this ID number already exists" 
      });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ 
          error: "User with this email already exists" 
        });
      }
    }

    // Validate role
    const validRoles = ["student", "ssc", "oss", "dean", "super"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}` 
      });
    }

    // Create user object
    const userData = {
      idNumber: parseInt(idNumber),
      firstName: firstName.trim(),
      middleName: middleName ? middleName.trim() : "",
      lastName: lastName.trim(),
      age: parseInt(age),
      role,
    };

    // Add student-specific fields
    if (role === "student") {
      if (!yearLevel || !section) {
        return res.status(400).json({ 
          error: "Students require yearLevel and section" 
        });
      }
      userData.yearLevel = yearLevel.trim();
      userData.section = section.trim();
      userData.course = course ? course.trim() : "";
      userData.strand = strand ? strand.trim() : "";
    }

    // Add SSC position if applicable
    if (role === "ssc") {
      userData.sscPosition = sscPosition ? sscPosition.trim() : "";
      if (!yearLevel || !section) {
        return res.status(400).json({ 
          error: "SSC members require yearLevel and section" 
        });
      }
      userData.yearLevel = yearLevel.trim();
      userData.section = section.trim();
      userData.course = course ? course.trim() : "";
      userData.strand = strand ? strand.trim() : "";
    }

    // Add optional fields
    if (email) userData.email = email.trim().toLowerCase();
    if (password) userData.password = password; // Will be hashed by pre-save hook

    // Create the user
    const newUser = new User(userData);
    await newUser.save();

    // Return user without sensitive data
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.qrCode;

    res.status(201).json({ 
      message: "User created successfully", 
      user: userResponse 
    });
  } catch (err) {
    console.error("Error creating user:", err);
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        error: `A user with this ${field} already exists` 
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

    // Trim string fields
    Object.keys(updates).forEach(key => {
      if (typeof updates[key] === 'string') {
        updates[key] = updates[key].trim();
      }
    });

    // Convert numeric fields
    if (updates.age) updates.age = parseInt(updates.age);

    const user = await User.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { new: true, runValidators: true }
    ).select("-password -qrCode");

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
        error: `A user with this ${field} already exists` 
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

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: "Password must be at least 6 characters long" 
      });
    }

    // Hash the password
    const hashed = await bcrypt.hash(newPassword, 10);
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { password: hashed },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

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
        idNumber: user.idNumber
      }
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
    const validRoles = ["student", "ssc", "oss", "dean", "super"];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}` 
      });
    }

    const users = await User.find({ role })
      .select("-password -qrCode")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      role,
      count: users.length,
      users
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
      deans,
      registeredUsers,
      collegeStudents,
      seniorHighStudents
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "ssc" }),
      User.countDocuments({ role: "oss" }),
      User.countDocuments({ role: "dean" }),
      User.countDocuments({ email: { $exists: true, $ne: "" } }),
      User.countDocuments({ 
        role: "student", 
        course: { $exists: true, $ne: "" } 
      }),
      User.countDocuments({ 
        role: "student", 
        strand: { $exists: true, $ne: "" } 
      })
    ]);

    res.json({
      totalUsers,
      byRole: {
        students,
        sscMembers,
        ossStaff,
        deans
      },
      registeredUsers,
      pendingUsers: totalUsers - registeredUsers,
      studentBreakdown: {
        college: collegeStudents,
        seniorHigh: seniorHighStudents
      }
    });
  } catch (err) {
    console.error("Error fetching statistics:", err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

module.exports = router;