const Notification = require("../models/Notification");
const mongoose = require("mongoose");

/* ===============================
   CREATE (OSS / ADMIN)
================================ */
const createNotification = async (req, res) => {
  try {
    const { title, message, createdBy } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: "Title and message are required"
      });
    }

    const notif = await Notification.create({
      title,
      message,
      createdBy: createdBy || "Admin"
    });

    res.status(201).json({
      success: true,
      message: "Notification created",
      notif
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===============================
   READ ALL (ROLE AWARE)
================================ */
const getNotifications = async (req, res) => {
  try {
    const { userId, role } = req.query;

    let query = { isDeleted: false };

    // Student / SSC filtering
    if (role === "student" || role === "ssc") {
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required"
        });
      }

      // Fix: convert to ObjectId for proper MongoDB comparison
      const userObjectId = new mongoose.Types.ObjectId(userId);
      query.deletedBy = { $ne: userObjectId };
    }

    const notifications = await Notification.find(query).sort({
      createdAt: -1
    });

    res.json({ success: true, notifications });
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
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
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
      req.params.id,
      { title, message },
      { new: true, runValidators: true }
    );

    if (!notif) {
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
    }

    res.json({
      success: true,
      message: "Notification updated",
      notif
    });
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

    if (!notif) {
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
    }

    // OSS / ADMIN → HARD DELETE (hide from everyone)
    if (role === "oss" || role === "admin") {
      notif.isDeleted = true;
      await notif.save();

      return res.json({
        success: true,
        message: "Notification deleted for all users"
      });
    }

    // STUDENT / SSC → SOFT DELETE (hide for this user only)
    if (role === "student" || role === "ssc") {
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required"
        });
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Fix: compare as strings to avoid duplicate ObjectId entries
      const alreadyDeleted = notif.deletedBy.some(
        (id) => id.toString() === userObjectId.toString()
      );

      if (!alreadyDeleted) {
        notif.deletedBy.push(userObjectId);
        await notif.save();
      }

      return res.json({
        success: true,
        message: "Notification hidden for this user"
      });
    }

    res.status(403).json({
      success: false,
      error: "Invalid role"
    });
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

    if (!notif) {
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fix: compare as strings to avoid duplicate entries
    const alreadyRead = notif.readBy.some(
      (id) => id.toString() === userObjectId.toString()
    );

    if (!alreadyRead) {
      notif.readBy.push(userObjectId);
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

    if (!notif) {
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
    }

    // Fix: use toString() so ObjectId vs string comparison works correctly
    notif.readBy = notif.readBy.filter(
      (id) => id.toString() !== userId.toString()
    );
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

    // Fix: convert to ObjectId so $ne works correctly on ObjectId arrays
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const unread = await Notification.find({
      isDeleted: false,
      deletedBy: { $ne: userObjectId },
      readBy: { $ne: userObjectId }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: unread.length,
      notifications: unread
    });
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
  getUnreadNotifications
};