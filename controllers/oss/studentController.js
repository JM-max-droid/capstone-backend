// controllers/oss/studentController.js
const User = require("../../models/User");
const bcrypt = require("bcryptjs");

/**
 * GET students / ssc (pagination + filters)
 */
exports.getStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      regType,
      yearLevel,
      role,
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { role: { $in: ["student", "ssc"] } };

    if (role === "ssc") query.role = "ssc";
    else if (role === "student") query.role = "student";

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { course: new RegExp(search, "i") },
        { strand: new RegExp(search, "i") },
      ];
    }

    if (regType === "college") {
      query.course = { $exists: true, $ne: "", $ne: null };
    }
    if (regType === "senior") {
      query.strand = { $exists: true, $ne: "", $ne: null };
    }

    if (yearLevel) query.yearLevel = yearLevel;

    const students = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .select("-password -verificationToken -verificationTokenExpiry -__v")
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      students,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("🔥 Fetch students error:", err);
    res.status(500).json({ error: "Server error fetching students" });
  }
};

/**
 * POST - Add Student
 */
exports.addStudent = async (req, res) => {
  try {
    const {
      idNumber,
      firstName,
      middleName = "",
      lastName,
      age,
      course = "",
      strand = "",
      yearLevel,
      section,
      email = "",
      password = "",
    } = req.body;

    console.log("📝 Received student data:", {
      idNumber, firstName, lastName, age, course, strand, yearLevel, section,
      hasEmail: !!email, hasPassword: !!password,
    });

    if (!idNumber || !firstName || !lastName || !age || !yearLevel || !section) {
      return res.status(400).json({ error: "Incomplete data. Please fill all required fields." });
    }

    if (!course.trim() && !strand.trim()) {
      return res.status(400).json({ error: "Course or Strand is required" });
    }

    const exists = await User.findOne({ idNumber: Number(idNumber) });
    if (exists) {
      return res.status(400).json({ error: "Student with this ID number already exists" });
    }

    if (email && email.trim()) {
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ error: "Email already registered" });
      }
    }

    const studentData = {
      idNumber: Number(idNumber),
      firstName: firstName.trim(),
      middleName: middleName.trim() || "",
      lastName: lastName.trim(),
      age: Number(age),
      yearLevel: yearLevel.trim(),
      section: section.trim(),
      role: "student",
      photoURL: "",
      qrCode: "",
      course: course.trim() ? course.trim() : "",
      strand: strand.trim() ? strand.trim() : "",
    };

    if (email && email.trim()) {
      studentData.email = email.trim().toLowerCase();
    }

    if (password && password.trim()) {
      studentData.password = await bcrypt.hash(password.trim(), 10);
    }

    const student = await User.create(studentData);

    const createdStudent = await User.findById(student._id)
      .select("-password -verificationToken -verificationTokenExpiry -__v")
      .lean();

    console.log("✅ Student added successfully:", createdStudent.idNumber);

    res.status(201).json({
      message: "Student added successfully",
      student: createdStudent,
    });
  } catch (err) {
    console.error("🔥 Add student error:", err);
    if (err.name === "ValidationError") {
      const errors = Object.keys(err.errors).map((key) => ({
        field: key,
        message: err.errors[key].message,
      }));
      return res.status(400).json({ error: "Validation error", details: errors });
    }
    res.status(500).json({ error: "Server error adding student", details: err.message });
  }
};

/**
 * PUT - Update Student
 */
exports.updateStudent = async (req, res) => {
  try {
    const idNumber = req.params.idNumber;
    const payload = {};

    console.log("📝 Updating student:", idNumber);

    ["firstName", "middleName", "lastName", "age", "yearLevel", "section"].forEach((field) => {
      if (req.body[field] !== undefined) {
        payload[field] =
          typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
      }
    });

    if (req.body.course !== undefined && req.body.course.trim()) {
      payload.course = req.body.course.trim();
      payload.strand = "";
    }

    if (req.body.strand !== undefined && req.body.strand.trim()) {
      payload.strand = req.body.strand.trim();
      payload.course = "";
    }

    if (req.body.sscPosition !== undefined) {
      payload.sscPosition = req.body.sscPosition.trim();
    }

    if (req.body.email !== undefined && req.body.email.trim()) {
      const emailToUpdate = req.body.email.trim().toLowerCase();
      const emailExists = await User.findOne({
        email: emailToUpdate,
        idNumber: { $ne: Number(idNumber) },
      });
      if (emailExists) {
        return res.status(400).json({ error: "Email already registered to another user" });
      }
      payload.email = emailToUpdate;
    }

    if (req.body.password !== undefined && req.body.password.trim()) {
      payload.password = await bcrypt.hash(req.body.password.trim(), 10);
      console.log("🔐 Password will be updated (hashed)");
    }

    const student = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: { $in: ["student", "ssc"] } },
      payload,
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    console.log("✅ Student updated successfully:", student.idNumber);

    res.json({ message: "Student updated successfully", student });
  } catch (err) {
    console.error("🔥 Update student error:", err);
    res.status(500).json({ error: "Server error updating student", details: err.message });
  }
};

/**
 * POST - Reset Password (dedicated endpoint)
 */
exports.resetPassword = async (req, res) => {
  try {
    const { idNumber, newPassword } = req.body;

    console.log("🔑 Resetting password for student:", idNumber);

    if (!idNumber || !newPassword) {
      return res.status(400).json({ error: "ID number and new password are required" });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Find student first to verify they exist and have an account
    const student = await User.findOne({
      idNumber: Number(idNumber),
      role: { $in: ["student", "ssc"] },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (!student.email) {
      return res.status(400).json({ error: "Student does not have a registered account" });
    }

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);

    await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: { $in: ["student", "ssc"] } },
      { password: hashedPassword },
      { new: true }
    );

    console.log("✅ Password reset successfully for student:", idNumber);

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("🔥 Reset password error:", err);
    res.status(500).json({ error: "Server error resetting password", details: err.message });
  }
};

/**
 * DELETE - Student
 */
exports.deleteStudent = async (req, res) => {
  try {
    const idNumber = req.params.idNumber;

    console.log("🗑️ Deleting student:", idNumber);

    const student = await User.findOneAndDelete({
      idNumber: Number(idNumber),
      role: { $in: ["student", "ssc"] },
    }).select("-password -verificationToken -verificationTokenExpiry -__v");

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    console.log("✅ Student deleted:", student.idNumber);

    res.json({
      message: "Student deleted successfully",
      deletedStudent: {
        idNumber: student.idNumber,
        firstName: student.firstName,
        lastName: student.lastName,
      },
    });
  } catch (err) {
    console.error("🔥 Delete student error:", err);
    res.status(500).json({ error: "Server error deleting student", details: err.message });
  }
};

/**
 * POST - Convert Student to SSC
 */
exports.convertToSSC = async (req, res) => {
  try {
    const { idNumber, position } = req.body;

    if (!idNumber || !position) {
      return res.status(400).json({ error: "Missing ID number or position" });
    }

    console.log("🔄 Converting student to SSC:", idNumber, "Position:", position);

    const student = await User.findOne({ idNumber: Number(idNumber), role: "student" });

    if (!student) {
      return res.status(404).json({ error: "Student not found or not eligible for conversion" });
    }

    if (!student.email || !student.photoURL) {
      return res.status(400).json({
        error: "Only fully registered students can be converted to SSC",
      });
    }

    const updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "student" },
      { role: "ssc", sscPosition: position.trim() },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    console.log("✅ Student converted to SSC:", updated.idNumber);

    res.json({ message: "Student converted to SSC successfully", sscUser: updated });
  } catch (err) {
    console.error("🔥 Convert SSC error:", err);
    res.status(500).json({ error: "Server error converting to SSC", details: err.message });
  }
};

/**
 * POST - Remove SSC Status
 */
exports.removeFromSSC = async (req, res) => {
  try {
    const { idNumber } = req.body;

    if (!idNumber) {
      return res.status(400).json({ error: "Missing ID number" });
    }

    console.log("🔄 Removing SSC status from:", idNumber);

    const sscUser = await User.findOne({ idNumber: Number(idNumber), role: "ssc" });

    if (!sscUser) {
      return res.status(404).json({ error: "SSC officer not found" });
    }

    const updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "ssc" },
      { role: "student", sscPosition: "" },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    console.log("✅ SSC status removed:", updated.idNumber);

    res.json({ message: "SSC officer removed successfully", student: updated });
  } catch (err) {
    console.error("🔥 Remove SSC error:", err);
    res.status(500).json({ error: "Server error removing SSC status", details: err.message });
  }
};