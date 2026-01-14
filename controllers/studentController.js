// controllers/studentController.js - FIXED VERSION
const Student = require("../models/Student");
const User = require("../models/User");
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

    // Role filter
    if (role === "ssc") query.role = "ssc";
    else if (role === "student") query.role = "student";

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

    // Fetch students with proper pagination
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
 * POST - Add Student - COMPLETELY FIXED
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
      idNumber, 
      firstName, 
      lastName, 
      age, 
      course, 
      strand, 
      yearLevel, 
      section,
      hasEmail: !!email,
      hasPassword: !!password 
    });

    // Required fields validation
    if (!idNumber || !firstName || !lastName || !age || !yearLevel || !section) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ error: "Incomplete data. Please fill all required fields." });
    }

    // Course or strand must exist
    if (!course.trim() && !strand.trim()) {
      console.log("❌ No course or strand provided");
      return res.status(400).json({ error: "Course or Strand is required" });
    }

    // Check if ID number already exists
    const exists = await User.findOne({ idNumber: Number(idNumber) });
    if (exists) {
      console.log("❌ ID number already exists:", idNumber);
      return res.status(400).json({ error: "Student with this ID number already exists" });
    }

    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) {
        console.log("❌ Email already registered:", email);
        return res.status(400).json({ error: "Email already registered" });
      }
    }

    // Prepare student data with ALL required fields for User schema
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
      // Set course or strand, make sure the other is empty string
      course: course.trim() ? course.trim() : "",
      strand: strand.trim() ? strand.trim() : "",
    };

    // Only add email if provided (don't add empty string)
    if (email && email.trim()) {
      studentData.email = email.trim().toLowerCase();
    }

    // Only add password if provided (don't add empty string)
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      studentData.password = hashedPassword;
      console.log("🔐 Password hashed and added");
    }

    console.log("💾 Creating student with final data:", {
      ...studentData,
      password: studentData.password ? "***HIDDEN***" : "empty"
    });

    // Create student using User model directly (bypassing Student model wrapper)
    const student = await User.create(studentData);

    console.log("✅ Student created in database with ID:", student._id);

    // Fetch the created student without sensitive data
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
    console.error("🔥 Error stack:", err.stack);
    
    // Check for validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.keys(err.errors).map(key => ({
        field: key,
        message: err.errors[key].message
      }));
      console.error("🔥 Validation errors:", errors);
      return res.status(400).json({ 
        error: "Validation error",
        details: errors
      });
    }
    
    res.status(500).json({ 
      error: "Server error adding student",
      details: err.message 
    });
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

    // Fields to update
    ["firstName", "middleName", "lastName", "age", "yearLevel", "section"].forEach(
      (field) => {
        if (req.body[field] !== undefined) {
          payload[field] =
            typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
        }
      }
    );

    // Update course/strand properly - clear the other one
    if (req.body.course !== undefined) {
      if (req.body.course && req.body.course.trim()) {
        payload.course = req.body.course.trim();
        payload.strand = "";
      }
    }

    if (req.body.strand !== undefined) {
      if (req.body.strand && req.body.strand.trim()) {
        payload.strand = req.body.strand.trim();
        payload.course = "";
      }
    }

    // Handle SSC position update
    if (req.body.sscPosition !== undefined) {
      payload.sscPosition = req.body.sscPosition.trim();
    }

    // Handle email update
    if (req.body.email !== undefined && req.body.email.trim()) {
      const emailToUpdate = req.body.email.trim().toLowerCase();
      
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ 
        email: emailToUpdate,
        idNumber: { $ne: Number(idNumber) }
      });
      
      if (emailExists) {
        return res.status(400).json({ error: "Email already registered to another user" });
      }
      
      payload.email = emailToUpdate;
    }

    // Handle password update - hash it BEFORE updating
    if (req.body.password !== undefined && req.body.password.trim()) {
      const hashedPassword = await bcrypt.hash(req.body.password.trim(), 10);
      payload.password = hashedPassword;
      console.log("🔐 Password will be updated (hashed)");
    }

    console.log("💾 Updating student in database with payload:", {
      ...payload,
      password: payload.password ? "***HIDDEN***" : undefined
    });

    // Update directly in User collection
    const student = await User.findOneAndUpdate(
      { 
        idNumber: Number(idNumber),
        role: { $in: ["student", "ssc"] }
      },
      payload,
      { 
        new: true, 
        runValidators: true 
      }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    console.log("✅ Student updated successfully:", student.idNumber);

    res.json({
      message: "Student updated successfully",
      student,
    });
  } catch (err) {
    console.error("🔥 Update student error:", err);
    res.status(500).json({ 
      error: "Server error updating student",
      details: err.message 
    });
  }
};

/**
 * DELETE - Student (Only for Students tab)
 */
exports.deleteStudent = async (req, res) => {
  try {
    const idNumber = req.params.idNumber;
    
    console.log("🗑️ Deleting student:", idNumber);

    // Delete student using User model directly
    const student = await User.findOneAndDelete({
      idNumber: Number(idNumber),
      role: { $in: ["student", "ssc"] }
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
    res.status(500).json({ 
      error: "Server error deleting student",
      details: err.message 
    });
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

    // Ensure student exists and is a regular student
    const student = await User.findOne({ 
      idNumber: Number(idNumber), 
      role: "student" 
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found or not eligible for conversion" });
    }

    // Ensure student is fully registered
    if (!student.email || !student.photoURL) {
      return res.status(400).json({
        error: "Only fully registered students can be converted to SSC",
      });
    }

    // Convert to SSC
    const updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "student" },
      { 
        role: "ssc",
        sscPosition: position.trim()
      },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    console.log("✅ Student converted to SSC:", updated.idNumber);

    res.json({
      message: "Student converted to SSC successfully",
      sscUser: updated,
    });
  } catch (err) {
    console.error("🔥 Convert SSC error:", err);
    res.status(500).json({ 
      error: "Server error converting to SSC",
      details: err.message 
    });
  }
};

/**
 * POST - Remove SSC Status (Convert back to regular student)
 */
exports.removeFromSSC = async (req, res) => {
  try {
    const { idNumber } = req.body;

    if (!idNumber) {
      return res.status(400).json({ error: "Missing ID number" });
    }

    console.log("🔄 Removing SSC status from:", idNumber);

    // Find the SSC user
    const sscUser = await User.findOne({ 
      idNumber: Number(idNumber), 
      role: "ssc" 
    });

    if (!sscUser) {
      return res.status(404).json({ error: "SSC officer not found" });
    }

    // Convert back to regular student
    const updated = await User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "ssc" },
      { 
        role: "student",
        sscPosition: "" // Clear the SSC position
      },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");

    console.log("✅ SSC status removed, user reverted to student:", updated.idNumber);

    res.json({
      message: "SSC officer removed successfully",
      student: updated,
    });
  } catch (err) {
    console.error("🔥 Remove SSC error:", err);
    res.status(500).json({ 
      error: "Server error removing SSC status",
      details: err.message 
    });
  }
};