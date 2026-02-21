// controllers/superadmin/studentController.js
const User   = require("../../models/User");
const bcrypt = require("bcryptjs");

const validateEmail    = (e)  => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validateIdNumber = (id) => /^\d+$/.test(String(id));
const validateAge      = (a)  => { const n = parseInt(a); return !isNaN(n) && n >= 1 && n <= 120; };
const validatePassword = (p)  => p && p.length >= 6;

// ═══════════════════════════════════════════════════════════════
//  STUDENT + SSC
// ═══════════════════════════════════════════════════════════════

exports.getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = "", regType, yearLevel, role } = req.query;
    const skip  = (page - 1) * limit;
    const query = { role: { $in: ["student", "ssc"] } };

    if (role === "ssc")          query.role = "ssc";
    else if (role === "student") query.role = "student";

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName:  new RegExp(search, "i") },
        { course:    new RegExp(search, "i") },
        { strand:    new RegExp(search, "i") },
      ];
    }

    if (regType === "college") query.course = { $exists: true, $ne: "" };
    if (regType === "senior")  query.strand  = { $exists: true, $ne: "" };
    if (yearLevel)             query.yearLevel = yearLevel;

    const students = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .select("-password -verificationToken -verificationTokenExpiry -__v")
      .lean();

    const total = await User.countDocuments(query);
    res.json({ students, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("🔥 Fetch students error:", err);
    res.status(500).json({ error: "Server error fetching students" });
  }
};

exports.addStudent = async (req, res) => {
  try {
    const {
      idNumber, firstName, middleName = "", lastName,
      age, course = "", strand = "", yearLevel, section,
      email = "", password = "",
    } = req.body;

    if (!idNumber || !firstName || !lastName || !age || !yearLevel || !section)
      return res.status(400).json({ error: "Incomplete data. Please fill all required fields." });
    if (!course.trim() && !strand.trim())
      return res.status(400).json({ error: "Course or Strand is required" });

    const exists = await User.findOne({ idNumber: Number(idNumber) });
    if (exists) return res.status(400).json({ error: "Student with this ID number already exists" });

    if (email && email.trim()) {
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) return res.status(400).json({ error: "Email already registered" });
    }

    const studentData = {
      idNumber:   Number(idNumber),
      firstName:  firstName.trim(),
      middleName: middleName.trim() || "",
      lastName:   lastName.trim(),
      age:        Number(age),
      yearLevel:  yearLevel.trim(),
      section:    section.trim(),
      role:       "student",
      photoURL:   "",
      qrCode:     "",
      course:     course.trim() || "",
      strand:     strand.trim() || "",
    };

    if (email && email.trim())       studentData.email    = email.trim().toLowerCase();
    if (password && password.trim()) studentData.password = await bcrypt.hash(password.trim(), 10);

    const student = await User.create(studentData);
    const created = await User.findById(student._id)
      .select("-password -verificationToken -verificationTokenExpiry -__v").lean();

    console.log("✅ Student added:", created.idNumber);
    res.status(201).json({ message: "Student added successfully", student: created });
  } catch (err) {
    console.error("🔥 Add student error:", err);
    if (err.name === "ValidationError") {
      const errors = Object.keys(err.errors).map((k) => ({ field: k, message: err.errors[k].message }));
      return res.status(400).json({ error: "Validation error", details: errors });
    }
    res.status(500).json({ error: "Server error adding student", details: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const idNumber = req.params.idNumber;
    const payload  = {};

    ["firstName", "middleName", "lastName", "age", "yearLevel", "section"].forEach((field) => {
      if (req.body[field] !== undefined)
        payload[field] = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
    });

    if (req.body.course !== undefined && req.body.course.trim()) { payload.course = req.body.course.trim(); payload.strand = ""; }
    if (req.body.strand !== undefined && req.body.strand.trim()) { payload.strand = req.body.strand.trim(); payload.course = ""; }
    if (req.body.sscPosition !== undefined) payload.sscPosition = req.body.sscPosition.trim();

    if (req.body.email !== undefined && req.body.email.trim()) {
      const emailToUpdate = req.body.email.trim().toLowerCase();
      const emailExists   = await User.findOne({ email: emailToUpdate, idNumber: { $ne: Number(idNumber) } });
      if (emailExists) return res.status(400).json({ error: "Email already registered to another user" });
      payload.email = emailToUpdate;
    }

    if (req.body.password !== undefined && req.body.password.trim())
      payload.password = await bcrypt.hash(req.body.password.trim(), 10);

    const student = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: { $in: ["student", "ssc"] } },
      payload,
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    if (!student) return res.status(404).json({ error: "Student not found" });
    console.log("✅ Student updated:", student.idNumber);
    res.json({ message: "Student updated successfully", student });
  } catch (err) {
    console.error("🔥 Update student error:", err);
    res.status(500).json({ error: "Server error updating student", details: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await User.findOneAndDelete({
      idNumber: Number(req.params.idNumber),
      role:     { $in: ["student", "ssc"] },
    }).select("-password -verificationToken -verificationTokenExpiry -__v");

    if (!student) return res.status(404).json({ error: "Student not found" });
    console.log("✅ Student deleted:", student.idNumber);
    res.json({ message: "Student deleted successfully", deletedStudent: { idNumber: student.idNumber, firstName: student.firstName, lastName: student.lastName } });
  } catch (err) {
    console.error("🔥 Delete student error:", err);
    res.status(500).json({ error: "Server error deleting student", details: err.message });
  }
};

exports.convertToSSC = async (req, res) => {
  try {
    const { idNumber, position } = req.body;
    if (!idNumber || !position) return res.status(400).json({ error: "Missing ID number or position" });

    const student = await User.findOne({ idNumber: Number(idNumber), role: "student" });
    if (!student) return res.status(404).json({ error: "Student not found or not eligible" });
    if (!student.email || !student.photoURL)
      return res.status(400).json({ error: "Only fully registered students can be converted to SSC" });

    const updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "student" },
      { role: "ssc", sscPosition: position.trim() },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    console.log("✅ Converted to SSC:", updated.idNumber);
    res.json({ message: "Student converted to SSC successfully", sscUser: updated });
  } catch (err) {
    console.error("🔥 Convert SSC error:", err);
    res.status(500).json({ error: "Server error converting to SSC", details: err.message });
  }
};

exports.removeFromSSC = async (req, res) => {
  try {
    const { idNumber } = req.body;
    if (!idNumber) return res.status(400).json({ error: "Missing ID number" });

    const sscUser = await User.findOne({ idNumber: Number(idNumber), role: "ssc" });
    if (!sscUser) return res.status(404).json({ error: "SSC officer not found" });

    const updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "ssc" },
      { role: "student", sscPosition: "" },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    console.log("✅ SSC reverted to student:", updated.idNumber);
    res.json({ message: "SSC officer removed successfully", student: updated });
  } catch (err) {
    console.error("🔥 Remove SSC error:", err);
    res.status(500).json({ error: "Server error removing SSC status", details: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  OSS + SUPER  (same controller, different role filter)
// ═══════════════════════════════════════════════════════════════

exports.getOssUsers = async (req, res) => {
  try {
    const { page = 1, limit = 9999, search = "" } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const query = { role: { $in: ["oss", "super"] } };

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName:  new RegExp(search, "i") },
        { email:     new RegExp(search, "i") },
      ];
    }

    const users = await User.find(query)
      .select("-password -qrCode -verificationToken -verificationTokenExpiry -__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);
    res.json({ users, page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error("🔥 Fetch OSS users error:", err);
    res.status(500).json({ error: "Server error fetching OSS users" });
  }
};

exports.addOssUser = async (req, res) => {
  try {
    const { idNumber, firstName, middleName = "", lastName, age, email = "", password = "", role } = req.body;

    if (!idNumber || !firstName || !lastName || !age || !role)
      return res.status(400).json({ error: "Missing required fields: idNumber, firstName, lastName, age, role" });
    if (!validateIdNumber(idNumber))             return res.status(400).json({ error: "ID Number must contain only digits" });
    if (!validateAge(age))                       return res.status(400).json({ error: "Age must be between 1 and 120" });
    if (email && !validateEmail(email))          return res.status(400).json({ error: "Please provide a valid email address" });
    if (password && !validatePassword(password)) return res.status(400).json({ error: "Password must be at least 6 characters long" });

    const validRoles = ["oss", "super"];
    if (!validRoles.includes(role))
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });

    const existingId = await User.findOne({ idNumber: Number(idNumber) });
    if (existingId) return res.status(400).json({ error: "User with this ID number already exists" });

    if (email && email.trim()) {
      const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingEmail) return res.status(400).json({ error: "Email already registered" });
    }

    const userData = {
      idNumber:   Number(idNumber),
      firstName:  firstName.trim(),
      middleName: middleName.trim() || "",
      lastName:   lastName.trim(),
      age:        Number(age),
      role,
      yearLevel:  "N/A",
      section:    "N/A",
      course:     "",
      strand:     "",
      photoURL:   "",
      qrCode:     "",
    };

    if (email && email.trim())       userData.email    = email.trim().toLowerCase();
    if (password && password.trim()) userData.password = await bcrypt.hash(password.trim(), 10);

    const newUser = await User.create(userData);
    const created = await User.findById(newUser._id)
      .select("-password -qrCode -verificationToken -verificationTokenExpiry -__v").lean();

    console.log("✅ OSS user added:", created.idNumber);
    res.status(201).json({ message: "User created successfully", user: created });
  } catch (err) {
    console.error("🔥 Add OSS user error:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ error: `A user with this ${field} already exists` });
    }
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(", ") });
    }
    res.status(500).json({ error: "Server error adding user", details: err.message });
  }
};

exports.updateOssUser = async (req, res) => {
  try {
    const idNumber = req.params.idNumber;
    const payload  = {};

    ["firstName", "middleName", "lastName", "age"].forEach((field) => {
      if (req.body[field] !== undefined)
        payload[field] = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
    });
    if (payload.age !== undefined) payload.age = Number(payload.age);
    if (payload.age !== undefined && !validateAge(payload.age))
      return res.status(400).json({ error: "Age must be between 1 and 120" });

    if (req.body.email !== undefined && req.body.email.trim()) {
      const emailToUpdate = req.body.email.trim().toLowerCase();
      if (!validateEmail(emailToUpdate)) return res.status(400).json({ error: "Please provide a valid email address" });
      const emailExists = await User.findOne({ email: emailToUpdate, idNumber: { $ne: Number(idNumber) } });
      if (emailExists) return res.status(400).json({ error: "Email already registered to another user" });
      payload.email = emailToUpdate;
    }

    if (req.body.password !== undefined && req.body.password.trim()) {
      if (!validatePassword(req.body.password.trim()))
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      payload.password = await bcrypt.hash(req.body.password.trim(), 10);
    }

    const user = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: { $in: ["oss", "super"] } },
      payload,
      { new: true, runValidators: true }
    ).select("-password -qrCode -verificationToken -verificationTokenExpiry -__v");

    if (!user) return res.status(404).json({ error: "User not found" });
    console.log("✅ OSS user updated:", user.idNumber);
    res.json({ message: "User updated successfully", user });
  } catch (err) {
    console.error("🔥 Update OSS user error:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ error: `A user with this ${field} already exists` });
    }
    res.status(500).json({ error: "Server error updating user", details: err.message });
  }
};

exports.deleteOssUser = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({
      idNumber: Number(req.params.idNumber),
      role:     { $in: ["oss", "super"] },
    }).select("-password -qrCode -verificationToken -verificationTokenExpiry -__v");

    if (!user) return res.status(404).json({ error: "User not found" });
    console.log("✅ OSS user deleted:", user.idNumber);
    res.json({ message: "User deleted successfully", deletedUser: { idNumber: user.idNumber, firstName: user.firstName, lastName: user.lastName } });
  } catch (err) {
    console.error("🔥 Delete OSS user error:", err);
    res.status(500).json({ error: "Server error deleting user", details: err.message });
  }
};