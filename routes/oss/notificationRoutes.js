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
router.get("/:id", getNotificationById);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

/* ========= STUDENT / SSC ========= */
router.post("/:id/read", markAsRead);
router.post("/:id/unread", markAsUnread);
router.get("/unread/:userId", getUnreadNotifications);

module.exports = router;