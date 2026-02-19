// backend/routes/ossRoutes.js
const express = require("express");
const router = express.Router();
const ossController = require("../../controllers/oss/ossControllers");

router.get("/findStudent", ossController.findStudent);
router.get("/", ossController.getAllAttendance);
router.post("/", ossController.addAttendance);
router.put("/:studentId", ossController.updateStudent);
router.delete("/:id", ossController.deleteAttendance);

module.exports = router;
