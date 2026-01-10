const express = require("express");
const router = express.Router();
const controller = require("../../controllers/studentController");

router.get("/", controller.getStudents);
router.post("/", controller.addStudent);
router.post("/convert-to-ssc", controller.convertToSSC);
router.put("/:idNumber", controller.updateStudent);
router.delete("/:idNumber", controller.deleteStudent);

module.exports = router;
