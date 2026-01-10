const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    createdBy: {
      type: String,
      default: "Admin"
    },

    // READ TRACKING
    readBy: [
      {
        type: String // userId
      }
    ],

    // STUDENT / SSC soft delete (hide only)
    deletedBy: [
      {
        type: String // userId
      }
    ],

    // OSS / ADMIN hard delete (global)
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Notification", NotificationSchema);