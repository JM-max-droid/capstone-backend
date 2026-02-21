const Notification = require("../models/Notification");

/* ===============================
   CREATE (OSS / ADMIN)
================================ */
const createNotification = async (req, res) => {
  try {
    const { title, message, createdBy } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: "Title and message are required" });
    }
    const notif = await Notification.create({ title, message, createdBy: createdBy || "Admin" });
    res.status(201).json({ success: true, message: "Notification created", notif });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   READ ALL (ROLE AWARE)
   KEY FIX: fetch all then filter in JS
   so ObjectId vs plain-string mismatch
   in MongoDB $ne never causes issues.
================================ */
const getNotifications = async (req, res) => {
  try {
    const { userId, role } = req.query;

    // OSS / ADMIN — return everything not hard-deleted
    if (role === "oss" || role === "admin") {
      const notifications = await Notification.find({ isDeleted: false }).sort({ createdAt: -1 });
      return res.json({ success: true, notifications });
    }

    // STUDENT / SSC — fetch all non-deleted, filter deletedBy in JS
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const all = await Notification.find({ isDeleted: false }).sort({ createdAt: -1 });

    const notifications = all.filter((n) => {
      const deletedByStrings = (n.deletedBy || []).map((id) => id.toString());
      return !deletedByStrings.includes(userId.toString());
    });

    return res.json({ success: true, notifications });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   READ ONE
================================ */
const getNotificationById = async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif || notif.isDeleted) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }
    res.json({ success: true, notif });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   UPDATE (OSS / ADMIN)
================================ */
const updateNotification = async (req, res) => {
  try {
    const { title, message } = req.body;
    const notif = await Notification.findByIdAndUpdate(
      req.params.id, { title, message }, { new: true, runValidators: true }
    );
    if (!notif) return res.status(404).json({ success: false, error: "Notification not found" });
    res.json({ success: true, message: "Notification updated", notif });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   DELETE (ROLE AWARE)
================================ */
const deleteNotification = async (req, res) => {
  try {
    const { role, userId } = req.body;
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, error: "Notification not found" });

    // OSS / ADMIN → hard delete
    if (role === "oss" || role === "admin") {
      notif.isDeleted = true;
      await notif.save();
      return res.json({ success: true, message: "Notification deleted for all users" });
    }

    // STUDENT / SSC → soft delete (hide for this user only)
    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });

    const alreadyDeleted = (notif.deletedBy || []).some((id) => id.toString() === userId.toString());
    if (!alreadyDeleted) {
      notif.deletedBy.push(userId);
      await notif.save();
    }
    return res.json({ success: true, message: "Notification hidden for this user" });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   MARK AS READ
================================ */
const markAsRead = async (req, res) => {
  try {
    const { userId } = req.body;
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, error: "Notification not found" });

    const alreadyRead = (notif.readBy || []).some((id) => id.toString() === userId.toString());
    if (!alreadyRead) {
      notif.readBy.push(userId);
      await notif.save();
    }
    res.json({ success: true, message: "Marked as read" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   MARK AS UNREAD
================================ */
const markAsUnread = async (req, res) => {
  try {
    const { userId } = req.body;
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, error: "Notification not found" });

    notif.readBy = (notif.readBy || []).filter((id) => id.toString() !== userId.toString());
    await notif.save();
    res.json({ success: true, message: "Marked as unread" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   GET UNREAD
================================ */
const getUnreadNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const all = await Notification.find({ isDeleted: false }).sort({ createdAt: -1 });

    const unread = all.filter((n) => {
      const deletedByStrings = (n.deletedBy || []).map((id) => id.toString());
      const readByStrings    = (n.readBy    || []).map((id) => id.toString());
      return (
        !deletedByStrings.includes(userId.toString()) &&
        !readByStrings.includes(userId.toString())
      );
    });

    res.json({ success: true, count: unread.length, notifications: unread });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  markAsRead,
  markAsUnread,
  getUnreadNotifications,
};