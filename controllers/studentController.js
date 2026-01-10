const Student = require("../models/Student");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

/**
 * =====================================================
 * GET students / ssc (pagination + filters)
 * =====================================================
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
    const query = {};

    // Role filter
    if (role === "ssc") query.role = "ssc";

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
    if (regType === "college") query.course = { $ne: "" };
    if (regType === "senior") query.strand = { $ne: "" };

    // Year level filter
    if (yearLevel) query.yearLevel = yearLevel;

    // Fetch students with proper pagination
    const students = await Student.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await Student.count(query);

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
 * =====================================================
 * POST - Add Student
 * =====================================================
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

    // Required fields
    if (!idNumber || !firstName || !lastName || !age || !yearLevel || !section) {
      return res.status(400).json({ error: "Incomplete data" });
    }

    // Course or strand must exist
    if (!course.trim() && !strand.trim()) {
      return res.status(400).json({ error: "Course or Strand is required" });
    }

    // Check existing student
    const exists = await Student.findOne({ idNumber: Number(idNumber) });
    if (exists) {
      return res.status(400).json({ error: "Student already exists" });
    }

    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ error: "Email already registered" });
      }
    }

    // Prepare student data
    const studentData = {
      idNumber: Number(idNumber),
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      lastName: lastName.trim(),
      age: Number(age),
      yearLevel: yearLevel.trim(),
      section: section.trim(),
    };

    // Add course OR strand, not both
    if (course.trim()) {
      studentData.course = course.trim();
      studentData.strand = "";
    } else {
      studentData.strand = strand.trim();
      studentData.course = "";
    }

    // Add email if provided
    if (email && email.trim()) {
      studentData.email = email.trim().toLowerCase();
    }

    // Add hashed password if provided
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      studentData.password = hashedPassword;
    }

    // Create student
    const student = await Student.create(studentData);

    console.log("✅ Student created:", student);

    res.status(201).json({
      message: "✅ Student added successfully",
      student,
    });
  } catch (err) {
    console.error("🔥 Add student error:", err);
    res.status(500).json({ error: "Server error adding student" });
  }
};

/**
 * =====================================================
 * PUT - Update Student
 * =====================================================
 */
exports.updateStudent = async (req, res) => {
  try {
    const idNumber = req.params.idNumber;
    const payload = {};

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

    if (req.body.sscPosition) {
      payload.sscPosition = req.body.sscPosition.trim();
    }

    // Handle email update
    if (req.body.email !== undefined && req.body.email.trim()) {
      const emailToUpdate = req.body.email.trim().toLowerCase();
      
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ 
        email: emailToUpdate,
        idNumber: { $ne: Number(idNumber) } // Exclude current student
      });
      
      if (emailExists) {
        return res.status(400).json({ error: "Email already registered to another user" });
      }
      
      payload.email = emailToUpdate;
    }

    // Handle password update (hash it first)
    if (req.body.password !== undefined && req.body.password.trim()) {
      const hashedPassword = await bcrypt.hash(req.body.password.trim(), 10);
      payload.password = hashedPassword;
    }

    console.log("📝 Updating student:", idNumber, "with payload:", payload);

    // Update student
    const student = await Student.updateByIdNumber(idNumber, payload);
    if (!student) return res.status(404).json({ error: "Student not found" });

    console.log("✅ Student updated:", student);

    res.json({
      message: "✅ Student updated successfully",
      student,
    });
  } catch (err) {
    console.error("🔥 Update student error:", err);
    res.status(500).json({ error: "Server error updating student" });
  }
};

/**
 * =====================================================
 * DELETE - Student
 * =====================================================
 */
exports.deleteStudent = async (req, res) => {
  try {
    console.log("🗑️ Deleting student:", req.params.idNumber);

    const student = await Student.deleteByIdNumber(req.params.idNumber);
    if (!student) return res.status(404).json({ error: "Student not found" });

    console.log("✅ Student deleted:", student.idNumber);

    res.json({
      message: "✅ Student deleted successfully",
      deletedStudent: {
        idNumber: student.idNumber,
        firstName: student.firstName,
        lastName: student.lastName,
      },
    });
  } catch (err) {
    console.error("🔥 Delete student error:", err);
    res.status(500).json({ error: "Server error deleting student" });
  }
};

/**
 * =====================================================
 * POST - Convert Student to SSC
 * =====================================================
 */
exports.convertToSSC = async (req, res) => {
  try {
    const { idNumber, position } = req.body;

    if (!idNumber || !position) {
      return res.status(400).json({ error: "Missing data" });
    }

    console.log("🔄 Converting student to SSC:", idNumber, "Position:", position);

    // Ensure student exists
    const student = await Student.findOne({ idNumber: Number(idNumber), role: "student" });
    if (!student) return res.status(404).json({ error: "Student not found" });

    // Ensure student is fully registered
    if (!student.email || !student.photoURL) {
      return res.status(400).json({
        error: "Only fully registered students can be converted to SSC",
      });
    }

    // Convert to SSC
    const updated = await Student.convertToSSC(Number(idNumber), position.trim());

    console.log("✅ Student converted to SSC:", updated);

    res.json({
      message: "✅ Student converted to SSC",
      sscUser: updated,
    });
  } catch (err) {
    console.error("🔥 Convert SSC error:", err);
    res.status(500).json({ error: "Server error converting to SSC" });
  }
};