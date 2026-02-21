// routes/superadmin/userRoute.js
const express           = require("express");
const studentController = require("../../controllers/superadmin/studentController");

const router = express.Router();

// All routes use :idNumber — consistent with studentController

// GET    /api/users              → list all OSS + super users
router.get("/",              studentController.getOssUsers);

// POST   /api/users              → create new OSS or super user
router.post("/",             studentController.addOssUser);

// PUT    /api/users/:idNumber    → update OSS/super user (handles password too)
router.put("/:idNumber",     studentController.updateOssUser);

// DELETE /api/users/:idNumber    → delete OSS/super user
router.delete("/:idNumber",  studentController.deleteOssUser);

module.exports = router;