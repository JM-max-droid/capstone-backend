const express = require("express");
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  markAsUnread,
  getUnreadNotifications,
} = require("../../controllers/notificationController");

const router = express.Router();

/* ─────────────────────────────────────────────────────────
   SSC NOTIFICATION ROUTES — VIEW ONLY
   Walang create, update, o delete na operations dito.
   SSC ay makakakita lang ng notifications na galing sa OSS/Admin.
───────────────────────────────────────────────────────── */

// STATIC ROUTES → dapat una bago ang /:id para hindi ma-conflict
router.get("/all",              getNotifications);        // GET  /all?userId=&role=ssc
router.get("/unread/:userId",   getUnreadNotifications);  // GET  /unread/:userId

// DYNAMIC ROUTES → pinaka-huli
router.get("/:id",              getNotificationById);     // GET  /:id
router.post("/:id/read",        markAsRead);              // POST /:id/read
router.post("/:id/unread",      markAsUnread);            // POST /:id/unread

module.exports = router;