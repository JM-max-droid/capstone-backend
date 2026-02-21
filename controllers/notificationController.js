const Notification = require("../models/Notification");

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

    console.log("[getNotifications] userId:", userId, "role:", role);

    // Debug: count lahat ng notifications sa DB
    const totalCount = await Notification.countDocuments({});
    console.log("[getNotifications] Total notifications in DB (no filter):", totalCount);

    // Debug: pati yung isDeleted:false
    const notDeletedCount = await Notification.countDocuments({ isDeleted: false });
    console.log("[getNotifications] Not deleted count:", notDeletedCount);

    // Debug: i-list lahat para makita kung may data talaga
    const allRaw = await Notification.find({}).lean();
    console.log("[getNotifications] All raw notifications:", JSON.stringify(allRaw.map(n => ({
      _id: n._id,
      title: n.title,
      isDeleted: n.isDeleted,
      deletedBy: n.deletedBy,
      createdAt: n.createdAt
    }))));

    let query = { isDeleted: false };

    if (role === "student" || role === "ssc") {
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required"
        });
      }
      query.deletedBy = { $ne: userId };
    }

    console.log("[getNotifications] Final query:", JSON.stringify(query));

    const notifications = await Notification.find(query).sort({ createdAt: -1 });

    console.log("[getNotifications] Found:", notifications.length);

    res.json({ success: true, notifications });
  } catch (e) {
    console.error("[getNotifications] Error:", e);
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

    // OSS / ADMIN → HARD DELETE
    if (role === "oss" || role === "admin") {
      notif.isDeleted = true;
      await notif.save();

      return res.json({
        success: true,
        message: "Notification deleted for all users"
      });
    }

    // STUDENT / SSC → SOFT DELETE
    if (role === "student" || role === "ssc") {
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "userId is required"
        });
      }

      if (!notif.deletedBy.includes(userId)) {
        notif.deletedBy.push(userId);
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

    if (!notif.readBy.includes(userId)) {
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

    if (!notif) {
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
    }

    notif.readBy = notif.readBy.filter(id => id !== userId);
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

    const unread = await Notification.find({
      isDeleted: false,
      deletedBy: { $ne: userId },
      readBy: { $ne: userId }
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