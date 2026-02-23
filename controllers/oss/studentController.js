// controllers/oss/studentController.js
const User = require("../../models/User");
const bcrypt = require("bcryptjs");

/**
 * GET students / ssc (pagination + filters)
 */
exports.getStudents = async (req, res) => {
  try {
    const {
      page  = 1,
      limit = 500,
      search = "",
      regType,
      yearLevel,
      role,
    } = req.query;

    const skip  = (Number(page) - 1) * Number(limit);
    const query = { role: { $in: ["student", "ssc"] } };

    // Role filter
    if (role === "ssc")     query.role = "ssc";
    else if (role === "student") query.role = "student";

    // Search filter
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName:  new RegExp(search, "i") },
        { course:    new RegExp(search, "i") },
        { strand:    new RegExp(search, "i") },
      ];
    }

    // ✅ FIXED: was using two $ne which is invalid in MongoDB
    if (regType === "college") {
      query.course = { $exists: true, $nin: ["", null] };
      query.strand = { $in: ["", null] };
    }
    if (regType === "senior") {
      query.strand = { $exists: true, $nin: ["", null] };
      query.course = { $in: ["", null] };
    }

    if (yearLevel) query.yearLevel = new RegExp(yearLevel, "i");

    const [students, total] = await Promise.all([
      User.find(query)
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(Number(limit))
        .select("-password -verificationToken -verificationTokenExpiry -__v")
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({
      students,
      page:       Number(page),
      limit:      Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
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
      course    = "",
      strand    = "",
      yearLevel,
      section,
      email     = "",
      password  = "",
      role      = "student",
    } = req.body;

    // ── Validation ───────────────────────────────────────────
    if (!idNumber || !firstName || !lastName || !age || !yearLevel || !section) {
      return res.status(400).json({ error: "Incomplete data. Please fill all required fields." });
    }

    if (!course.trim() && !strand.trim()) {
      return res.status(400).json({ error: "Course or Strand is required." });
    }

    // ── Duplicate checks ─────────────────────────────────────
    const exists = await User.findOne({ idNumber: Number(idNumber) });
    if (exists) {
      return res.status(400).json({ error: "A student with this ID number already exists." });
    }

    if (email.trim()) {
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ error: "This email is already registered." });
      }
    }

    // ── Build payload ────────────────────────────────────────
    const payload = {
      idNumber:   Number(idNumber),
      firstName:  firstName.trim(),
      middleName: middleName.trim(),
      lastName:   lastName.trim(),
      age:        Number(age),
      yearLevel:  yearLevel.trim(),
      section:    section.trim(),
      role:       ["student", "ssc"].includes(role) ? role : "student",
      course:     course.trim(),
      strand:     strand.trim(),
      photoURL:   "",
      qrCode:     "",
    };

    if (email.trim())    payload.email    = email.trim().toLowerCase();
    if (password.trim()) payload.password = await bcrypt.hash(password.trim(), 10);

    const student = await User.create(payload);
    const created = await User.findById(student._id)
      .select("-password -verificationToken -verificationTokenExpiry -__v")
      .lean();

    console.log("✅ Student added:", created.idNumber);
    res.status(201).json({ message: "Student added successfully", student: created });
  } catch (err) {
    console.error("🔥 Add student error:", err);
    if (err.name === "ValidationError") {
      const details = Object.keys(err.errors).map((k) => ({
        field: k, message: err.errors[k].message,
      }));
      return res.status(400).json({ error: "Validation error", details });
    }
    res.status(500).json({ error: "Server error adding student", details: err.message });
  }
};

/**
 * PUT - Update Student by idNumber
 */
exports.updateStudent = async (req, res) => {
  try {
    const { idNumber } = req.params;
    const payload = {};

    // ── Scalar fields ────────────────────────────────────────
    ["firstName", "middleName", "lastName", "yearLevel", "section"].forEach((f) => {
      if (req.body[f] !== undefined) payload[f] = String(req.body[f]).trim();
    });

    if (req.body.age !== undefined) payload.age = Number(req.body.age);

    // ── Course / Strand (mutually exclusive) ─────────────────
    const course = req.body.course?.trim();
    const strand = req.body.strand?.trim();

    if (course) { payload.course = course; payload.strand = ""; }
    else if (strand) { payload.strand = strand; payload.course = ""; }

    // ── SSC position ─────────────────────────────────────────
    if (req.body.sscPosition !== undefined) {
      payload.sscPosition = String(req.body.sscPosition).trim();
    }

    // ── Email ────────────────────────────────────────────────
    if (req.body.email?.trim()) {
      const emailTo = req.body.email.trim().toLowerCase();
      const conflict = await User.findOne({
        email: emailTo,
        idNumber: { $ne: Number(idNumber) },
      });
      if (conflict) {
        return res.status(400).json({ error: "Email already registered to another user." });
      }
      payload.email = emailTo;
    }

    // ── Password ─────────────────────────────────────────────
    if (req.body.password?.trim()) {
      payload.password = await bcrypt.hash(req.body.password.trim(), 10);
    }

    const student = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: { $in: ["student", "ssc"] } },
      payload,
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    console.log("✅ Student updated:", student.idNumber);
    res.json({ message: "Student updated successfully", student });
  } catch (err) {
    console.error("🔥 Update student error:", err);
    res.status(500).json({ error: "Server error updating student", details: err.message });
  }
};

/**
 * POST - Reset Password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { idNumber, newPassword } = req.body;

    if (!idNumber || !newPassword) {
      return res.status(400).json({ error: "ID number and new password are required." });
    }
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const student = await User.findOne({
      idNumber: Number(idNumber),
      role: { $in: ["student", "ssc"] },
    });

    if (!student) return res.status(404).json({ error: "Student not found." });
    if (!student.email) return res.status(400).json({ error: "Student does not have a registered account." });

    const hashed = await bcrypt.hash(newPassword.trim(), 10);
    await User.findOneAndUpdate(
      { idNumber: Number(idNumber) },
      { password: hashed }
    );

    console.log("✅ Password reset for:", idNumber);
    res.json({ message: "Password reset successfully." });
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
    const { idNumber } = req.params;

    const student = await User.findOneAndDelete({
      idNumber: Number(idNumber),
      role: { $in: ["student", "ssc"] },
    }).select("-password -verificationToken -verificationTokenExpiry -__v");

    if (!student) return res.status(404).json({ error: "Student not found." });

    console.log("✅ Student deleted:", student.idNumber);
    res.json({
      message: "Student deleted successfully",
      deletedStudent: {
        idNumber:  student.idNumber,
        firstName: student.firstName,
        lastName:  student.lastName,
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
      return res.status(400).json({ error: "ID number and position are required." });
    }

    const student = await User.findOne({ idNumber: Number(idNumber), role: "student" });
    if (!student) {
      return res.status(404).json({ error: "Student not found or not eligible for conversion." });
    }
    if (!student.email || !student.photoURL) {
      return res.status(400).json({
        error: "Only fully registered students (with email and photo) can be converted to SSC.",
      });
    }

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

/**
 * POST - Remove SSC Status → back to student
 */
exports.removeFromSSC = async (req, res) => {
  try {
    const { idNumber } = req.body;

    if (!idNumber) return res.status(400).json({ error: "ID number is required." });

    const sscUser = await User.findOne({ idNumber: Number(idNumber), role: "ssc" });
    if (!sscUser) return res.status(404).json({ error: "SSC officer not found." });

    const updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "ssc" },
      { role: "student", sscPosition: "" },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    console.log("✅ SSC removed:", updated.idNumber);
    res.json({ message: "SSC officer removed successfully", student: updated });
  } catch (err) {
    console.error("🔥 Remove SSC error:", err);
    res.status(500).json({ error: "Server error removing SSC status", details: err.message });
  }
};