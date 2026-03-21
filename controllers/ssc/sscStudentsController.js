// controllers/ssc/sscStudentController.js
const User = require("../../models/User");
const PendingStudent = require("../../models/pendingStudent");
const bcrypt = require("bcryptjs");

/**
 * GET students (view only - for SSC reference)
 */
exports.getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 500, search = "", regType, yearLevel } = req.query;
    const skip  = (page - 1) * limit;
    const query = { role: { $in: ["student", "ssc"] } };

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName:  new RegExp(search, "i") },
        { course:    new RegExp(search, "i") },
        { strand:    new RegExp(search, "i") },
      ];
    }
    if (regType === "college") query.course = { $exists: true, $nin: ["", null] };
    if (regType === "senior")  query.strand = { $exists: true, $nin: ["", null] };
    if (yearLevel) query.yearLevel = yearLevel;

    const students = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .select("-password -verificationToken -verificationTokenExpiry -__v")
      .lean();

    const total = await User.countDocuments(query);
    res.json({ students, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("🔥 SSC fetch students error:", err);
    res.status(500).json({ error: "Server error fetching students" });
  }
};

/**
 * POST /ssc/students/submit-for-approval
 * SSC submits a new student — goes to PendingStudent, NOT directly to User
 */
exports.submitStudentForApproval = async (req, res) => {
  try {
    const {
      idNumber, firstName, middleName = "", lastName, age,
      course = "", strand = "", yearLevel, section,
      email = "", password = "", submittedBy = "SSC Officer",
    } = req.body;

    // ── Required field check ─────────────────────────────────
    if (!idNumber || !firstName || !lastName || !age || !yearLevel || !section) {
      return res.status(400).json({ error: "Incomplete data. Please fill all required fields." });
    }
    if (!course.trim() && !strand.trim()) {
      return res.status(400).json({ error: "Course or Strand is required." });
    }

    // ── Duplicate checks in User (already registered) ────────
    const existsInUser = await User.findOne({ idNumber: Number(idNumber) });
    if (existsInUser) {
      return res.status(400).json({ error: "A student with this ID number already exists." });
    }

    if (email.trim()) {
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ error: "This email is already registered." });
      }
    }

    // ── Check if already in pending ──────────────────────────
    const existsPending = await PendingStudent.findOne({
      idNumber: Number(idNumber),
      status: "pending",
    });
    if (existsPending) {
      return res.status(400).json({ error: "A pending approval for this ID number already exists." });
    }

    // ── Create pending record ────────────────────────────────
    const pending = await PendingStudent.create({
      idNumber:   Number(idNumber),
      firstName:  firstName.trim(),
      middleName: middleName.trim(),
      lastName:   lastName.trim(),
      age:        Number(age),
      course:     course.trim(),
      strand:     strand.trim(),
      yearLevel:  yearLevel.trim(),
      section:    section.trim(),
      email:      email.trim().toLowerCase(),
      password:   password.trim(), // store plain-text temporarily; hashed on approval
      submittedBy,
      status:     "pending",
    });

    console.log("📋 [SSC] Student submitted for approval:", pending.idNumber);
    res.status(201).json({
      message: "Student submitted for approval. Waiting for OSS confirmation.",
      pendingId: pending._id,
    });
  } catch (err) {
    console.error("🔥 SSC submit student error:", err);
    res.status(500).json({ error: "Server error submitting student", details: err.message });
  }
};

/**
 * GET /ssc/students/pending
 * SSC can view their own submitted pending requests
 */
exports.getPendingSubmissions = async (req, res) => {
  try {
    const { status } = req.query; // optional filter: pending | approved | rejected
    const query = {};
    if (status) query.status = status;

    const pending = await PendingStudent.find(query).sort({ createdAt: -1 }).lean();
    res.json({ pending, total: pending.length });
  } catch (err) {
    console.error("🔥 SSC get pending error:", err);
    res.status(500).json({ error: "Server error fetching pending submissions" });
  }
};