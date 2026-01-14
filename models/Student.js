// ============================================
// 1. models/Student.js - FIXED
// ============================================
const User = require("./User");

class Student {
  static baseQuery() {
    return { role: { $in: ["student", "ssc"] } };
  }

  static find(query = {}) {
    return User.find({ ...this.baseQuery(), ...query }).select(
      "-password -verificationToken -verificationTokenExpiry -__v"
    );
  }

  static async findOne(query) {
    return User.findOne({ ...this.baseQuery(), ...query }).select(
      "-password -verificationToken -verificationTokenExpiry -__v"
    );
  }

  // ✅ FIXED: Changed from count() to countDocuments()
  static async countDocuments(query = {}) {
    return User.countDocuments({ ...this.baseQuery(), ...query });
  }

  static async create(data) {
    const studentData = {
      role: "student",
      email: data.email || "",
      photoURL: data.photoURL || "",
      qrCode: data.qrCode || "",
      ...data,
    };

    console.log("📝 Creating student with data:", studentData);

    const newStudent = await User.create(studentData);
    
    return User.findById(newStudent._id).select(
      "-password -verificationToken -verificationTokenExpiry -__v"
    );
  }

  static async updateByIdNumber(idNumber, data) {
    console.log("📝 Updating student:", idNumber, "Data:", data);

    return User.findOneAndUpdate(
      { idNumber: Number(idNumber), ...this.baseQuery() },
      data,
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");
  }

  static async deleteByIdNumber(idNumber) {
    console.log("🗑️ Deleting student:", idNumber);

    return User.findOneAndDelete({
      idNumber: Number(idNumber),
      ...this.baseQuery(),
    }).select("-password -verificationToken -verificationTokenExpiry -__v");
  }

  static async convertToSSC(idNumber, position) {
    console.log("🔄 Converting to SSC:", idNumber, "Position:", position);

    return User.findOneAndUpdate(
      { idNumber: Number(idNumber), role: "student" },
      { role: "ssc", sscPosition: position },
      { new: true, runValidators: true }
    ).select("-password -verificationToken -verificationTokenExpiry -__v");
  }
}

module.exports = Student;