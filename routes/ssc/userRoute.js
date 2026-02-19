const express = require("express");
const router = express.Router();
const {
  getSscUserById,
  updateSscPassword,
} = require("../../controllers/ssc/sscUserProfileController");

// GET  /api/ssc/user?idNumber=xxx  → fetch SSC user profile
router.get("/", getSscUserById);

// PUT  /api/ssc/user/update-password → change password
router.put("/update-password", updateSscPassword);

module.exports = router;