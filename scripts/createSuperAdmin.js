// backend/scripts/createSuperAdmin.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

require("dotenv").config();

async function createSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = "johnmarksena04@gmail.com";
    const password = "rollsrenz_1304";

    // Check if already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("SuperAdmin already exists!");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = new User({
      name: "John Mark Sena",
      email,
      password: hashedPassword,
      role: "super",
      idNumber: "130418", // ✅ add your idNumber here
      // Add other required fields if your schema has them
    });

    await superAdmin.save();
    console.log("✅ SuperAdmin created successfully!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createSuperAdmin();
