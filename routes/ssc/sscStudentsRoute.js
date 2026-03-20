// routes/ssc/sscStudentRoute.js
const express = require("express");
const router = express.Router();
const controller = require("../../controllers/ssc/sscStudentsController");

// GET all students (view only)
router.get("/", controller.getStudents);

// GET pending submissions (SSC can track their own submissions)
router.get("/pending", controller.getPendingSubmissions);

// POST submit new student for OSS approval (replaces direct add)
router.post("/submit-for-approval", controller.submitStudentForApproval);

module.exports = router;