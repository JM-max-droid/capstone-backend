// routes/superadmin/studentRoute.js
//
// Mounted in app.js as:
//   app.use("/api/student", superadminStudentRoute)
//
// So the full paths are:
//   GET    /api/student               → list students/ssc
//   POST   /api/student               → add student or ssc (manual)
//   POST   /api/student/convert-to-ssc → convert registered student to SSC
//   POST   /api/student/remove-from-ssc → revert SSC back to student
//   PUT    /api/student/:idNumber     → update student/ssc
//   DELETE /api/student/:idNumber     → delete student/ssc

const express           = require("express");
const studentController = require("../../controllers/superadmin/studentController");

const router = express.Router();

router.get("/",                   studentController.getStudents);
router.post("/",                  studentController.addStudent);

// ✅ Named routes MUST come before /:idNumber to avoid Express
//    treating "convert-to-ssc" as an idNumber parameter
router.post("/convert-to-ssc",    studentController.convertToSSC);
router.post("/remove-from-ssc",   studentController.removeFromSSC);

router.put("/:idNumber",          studentController.updateStudent);
router.delete("/:idNumber",       studentController.deleteStudent);

module.exports = router;