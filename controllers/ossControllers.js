// backend/controllers/ossController.js
const Attendance = require("../models/Attendance");
const User = require("../models/User");

const getAllAttendance = async (req, res) => {
  try {
    const { role } = req.query;
    if (role !== "oss") return res.status(403).json({ error: "Access denied" });

    const records = await Attendance.find({})
      .populate("studentId", "firstName lastName idNumber course yearLevel section photoURL")
      .populate("sscId", "name email")
      .sort({ date: -1 })
      .lean();

    res.status(200).json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const findStudent = async (req, res) => {
  try {
    const { idNumber } = req.query;
    if (!idNumber) return res.status(400).json({ error: "Missing idNumber" });

    const user = await User.findOne({ idNumber });
    if (!user) return res.status(404).json({ error: "Student not found" });

    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const addAttendance = async (req, res) => {
  try {
    const { studentId, sscId, status, role } = req.body;
    if (role !== "oss") return res.status(403).json({ error: "Access denied" });
    if (!studentId || !sscId) return res.status(400).json({ error: "Missing studentId or sscId" });

    const today = new Date().toISOString().split("T")[0];

    // Check existing
    const existing = await Attendance.findOne({ studentId, date: today });
    if (existing) return res.status(400).json({ error: "Attendance already recorded today" });

    const record = await Attendance.create({
      studentId,
      sscId,
      status: status || "present",
      date: today,
      time: new Date().toLocaleTimeString("en-US", { hour12: false }),
    });

    // ✅ Sync to Student & SSC (assume Attendance model has role field)
    await Attendance.create({ studentId, sscId, status: status || "done", date: today, role: "student" });
    await Attendance.create({ studentId, sscId, status: status || "done", date: today, role: "ssc" });

    res.status(201).json({ message: "Attendance saved", record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { role, firstName, lastName, course, yearLevel, section, idNumber } = req.body;
    if (role !== "oss") return res.status(403).json({ error: "Access denied" });

    const updatedUser = await User.findByIdAndUpdate(
      studentId,
      { firstName, lastName, course, yearLevel, section, idNumber },
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ error: "Student not found" });

    // ✅ Optionally update attendance records too
    await Attendance.updateMany({ studentId }, { $set: { firstName, lastName } });

    res.status(200).json({ message: "Student updated successfully", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const { role } = req.query;
    if (role !== "oss") return res.status(403).json({ error: "Access denied" });

    const deleted = await Attendance.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Record not found" });

    // ✅ Delete corresponding Student & SSC attendance
    await Attendance.deleteMany({ studentId: deleted.studentId, date: deleted.date, role: { $in: ["student","ssc"] } });

    res.status(200).json({ message: "Attendance deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getAllAttendance,
  findStudent,
  addAttendance,
  updateStudent,
  deleteAttendance,
};
