// controllers/oss/pendingStudentController.js
const User           = require("../models/User");
const PendingStudent = require("../models/PendingStudent");
const bcrypt         = require("bcryptjs");

/**
 * GET /superadmin/pending
 * List all pending student submissions
 */
exports.getPendingStudents = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 50 } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const query = {};
    if (status !== "all") query.status = status;

    const [pending, total] = await Promise.all([
      PendingStudent.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      PendingStudent.countDocuments(query),
    ]);

    res.json({ pending, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error("🔥 Get pending error:", err);
    res.status(500).json({ error: "Server error fetching pending students" });
  }
};

/**
 * POST /superadmin/pending/:id/approve
 * Approve a pending student → creates User record
 */
exports.approveStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const pending = await PendingStudent.findById(id);
    if (!pending) return res.status(404).json({ error: "Pending record not found." });
    if (pending.status !== "pending") {
      return res.status(400).json({ error: `Already ${pending.status}.` });
    }

    const existsInUser = await User.findOne({ idNumber: pending.idNumber });
    if (existsInUser) {
      await PendingStudent.findByIdAndUpdate(id, { status: "rejected", rejectionReason: "ID number already registered." });
      return res.status(400).json({ error: "Student ID already registered. Submission auto-rejected." });
    }

    const payload = {
      idNumber:   pending.idNumber,
      firstName:  pending.firstName,
      middleName: pending.middleName,
      lastName:   pending.lastName,
      age:        pending.age,
      course:     pending.course,
      strand:     pending.strand,
      yearLevel:  pending.yearLevel,
      section:    pending.section,
      role:       "student",
      photoURL:   "",
      qrCode:     "",
    };

    if (pending.email)    payload.email    = pending.email;
    if (pending.password) payload.password = await bcrypt.hash(pending.password, 10);

    const student = await User.create(payload);
    await PendingStudent.findByIdAndUpdate(id, { status: "approved" });

    const created = await User.findById(student._id)
      .select("-password -verificationToken -verificationTokenExpiry -__v")
      .lean();

    console.log("✅ OSS approved student:", created.idNumber);
    res.status(201).json({ message: "Student approved and added successfully.", student: created });
  } catch (err) {
    console.error("🔥 Approve student error:", err);
    res.status(500).json({ error: "Server error approving student", details: err.message });
  }
};

/**
 * POST /superadmin/pending/:id/reject
 * Reject a pending student
 */
exports.rejectStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Rejected by OSS." } = req.body;

    const pending = await PendingStudent.findById(id);
    if (!pending) return res.status(404).json({ error: "Pending record not found." });
    if (pending.status !== "pending") {
      return res.status(400).json({ error: `Already ${pending.status}.` });
    }

    await PendingStudent.findByIdAndUpdate(id, { status: "rejected", rejectionReason: reason.trim() });

    console.log("❌ OSS rejected student:", pending.idNumber, "| Reason:", reason);
    res.json({ message: "Student submission rejected.", reason });
  } catch (err) {
    console.error("🔥 Reject student error:", err);
    res.status(500).json({ error: "Server error rejecting student", details: err.message });
  }
};

/**
 * DELETE /superadmin/pending/:id
 * Permanently delete a single pending record
 */
exports.deletePendingStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PendingStudent.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Pending record not found." });
    res.json({ message: "Pending record deleted." });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

/**
 * DELETE /superadmin/pending/clear/:status
 * Permanently delete ALL PendingStudent records of a given status.
 * Only "approved" and "rejected" are allowed — "pending" is protected.
 * NOTE: Student accounts in the User collection are NOT touched.
 */
exports.clearByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Only 'approved' or 'rejected' records can be cleared." });
    }

    const result = await PendingStudent.deleteMany({ status });

    console.log(`🧹 Cleared ${result.deletedCount} ${status} PendingStudent records`);
    res.json({
      message: `${result.deletedCount} ${status} submission${result.deletedCount !== 1 ? "s" : ""} cleared successfully.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("🔥 Clear by status error:", err);
    res.status(500).json({ error: "Server error clearing records", details: err.message });
  }
};

/**
 * DELETE /superadmin/pending/clear-all
 * Permanently delete ALL approved AND rejected PendingStudent records.
 * Pending records and User accounts are NOT affected.
 */
exports.clearAll = async (req, res) => {
  try {
    const result = await PendingStudent.deleteMany({ status: { $in: ["approved", "rejected"] } });

    console.log(`🧹 Cleared all — deleted ${result.deletedCount} approved+rejected PendingStudent records`);
    res.json({
      message: `${result.deletedCount} submission${result.deletedCount !== 1 ? "s" : ""} cleared successfully.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("🔥 Clear all error:", err);
    res.status(500).json({ error: "Server error clearing all records", details: err.message });
  }
};