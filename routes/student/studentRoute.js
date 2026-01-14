// routes/student/studentRoute.js - FIXED WITH REMOVE SSC
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/studentController");

// GET all students/ssc with filters
router.get("/", controller.getStudents);

// POST add new student
router.post("/", controller.addStudent);

// POST convert student to SSC
router.post("/convert-to-ssc", controller.convertToSSC);

// POST remove SSC status (convert back to student)
router.post("/remove-from-ssc", controller.removeFromSSC);

// PUT update student by ID number
router.put("/:idNumber", controller.updateStudent);

// DELETE student by ID number
router.delete("/:idNumber", controller.deleteStudent);

module.exports = router;