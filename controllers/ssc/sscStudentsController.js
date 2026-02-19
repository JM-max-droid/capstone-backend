// controllers/ssc/sscStudentController.js
const User = require("../../models/User");
const bcrypt = require("bcryptjs");

/**
 * GET students (view only - for SSC reference)
 */
exports.getStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      regType,
      yearLevel,
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { role: { $in: ["student", "ssc"] } };

    // Search filter
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { course: new RegExp(search, "i") },
        { strand: new RegExp(search, "i") },
      ];
    }

    // Registration type filter
    if (regType === "college") {
      query.course = { $exists: true, $ne: "", $ne: null };
    }
    if (regType === "senior") {
      query.strand = { $exists: true, $ne: "", $ne: null };
    }

    // Year level filter
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
    console.error("🔥 SSC fetch students error:", err);
    res.status(500).json({ error: "Server error fetching students" });
  }
};

/**
 * POST - Add Student (SSC can add students only)
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

    console.log("📝 [SSC] Adding student:", { idNumber, firstName, lastName });

    // Required fields validation
    if (!idNumber || !firstName || !lastName || !age || !yearLevel || !section) {
      return res.status(400).json({ error: "Incomplete data. Please fill all required fields." });
    }

    // Course or strand must exist
    if (!course.trim() && !strand.trim()) {
      return res.status(400).json({ error: "Course or Strand is required" });
    }

    // Check if ID number already exists
    const exists = await User.findOne({ idNumber: Number(idNumber) });
    if (exists) {
      return res.status(400).json({ error: "Student with this ID number already exists" });
    }

    // Check if email already exists (if provided)
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
      console.log("🔐 [SSC] Password hashed");
    }

    const student = await User.create(studentData);

    const createdStudent = await User.findById(student._id)
      .select("-password -verificationToken -verificationTokenExpiry -__v")
      .lean();

    console.log("✅ [SSC] Student added:", createdStudent.idNumber);

    res.status(201).json({
      message: "Student added successfully",
      student: createdStudent,
    });
  } catch (err) {
    console.error("🔥 SSC add student error:", err);

    if (err.name === "ValidationError") {
      const errors = Object.keys(err.errors).map((key) => ({
        field: key,
        message: err.errors[key].message,
      }));
      return res.status(400).json({ error: "Validation error", details: errors });
    }

    res.status(500).json({
      error: "Server error adding student",
      details: err.message,
    });
  }
};