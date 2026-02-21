const express = require("express");
const {
  createNotification,
  getNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  markAsRead,
  markAsUnread,
  getUnreadNotifications
} = require("../../controllers/notificationController");

const router = express.Router();

/* ========= OSS / ADMIN ========= */
router.post("/create", createNotification);
router.get("/all", getNotifications);

// ⚠️ IMPORTANT: /unread/:userId must be BEFORE /:id
// otherwise Express will match "unread" as the :id param
router.get("/unread/:userId", getUnreadNotifications);

router.get("/:id", getNotificationById);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

/* ========= STUDENT / SSC ========= */
router.post("/:id/read", markAsRead);
router.post("/:id/unread", markAsUnread);

module.exports = router;