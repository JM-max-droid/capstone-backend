// routes/ssc/sscStudentRoute.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/ssc/sscStudentsController");

// GET all students (view only)
router.get("/", controller.getStudents);

// POST add new student (SSC can only add)
router.post("/", controller.addStudent);

module.exports = router;