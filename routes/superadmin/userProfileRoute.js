const express = require("express");
const router  = express.Router();
const {
  getUserById,
  updateProfileInfo,
  updatePassword,
  updateProfilePicture,
} = require("../../controllers/superadmin/userProfileController");

// ⚠️  Named routes FIRST, dynamic last
router.put("/update-info",     updateProfileInfo);
router.put("/update-password", updatePassword);
router.put("/update-picture",  updateProfilePicture);
router.get("/",                getUserById);

module.exports = router;