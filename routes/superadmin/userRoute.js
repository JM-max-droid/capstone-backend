// routes/superadmin/userRoute.js
//
// Mounted in app.js as:
//   app.use("/api/superadmin", superadminUserRoute)
//
// So the full paths are:
//   GET    /api/superadmin            → list all OSS + super users
//   POST   /api/superadmin            → create new OSS or super user
//   PUT    /api/superadmin/:idNumber  → update OSS/super user (handles password too)
//   DELETE /api/superadmin/:idNumber  → delete OSS/super user

const express           = require("express");
const studentController = require("../../controllers/superadmin/studentController");

const router = express.Router();

router.get("/",           studentController.getOssUsers);
router.post("/",          studentController.addOssUser);
router.put("/:idNumber",  studentController.updateOssUser);
router.delete("/:idNumber", studentController.deleteOssUser);

module.exports = router;