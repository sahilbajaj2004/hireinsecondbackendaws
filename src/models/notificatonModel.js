const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const NotificationSchema = Schema({
  userId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  notificationDetail: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    default: "New",
  },
  title: {
    type: String,
  },
  details: {
    type: String,
  },
  isClear: {
    type: Boolean,
    default: false,
  },

  sentAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  jobId: {
    type: String,
    required: false,
  },
  invitationId: {
    type: String,
    required: false,
  },
  invitationStatus: {
    type: String,
    default: "PENDING",
  },
  jobTitle: {
    type: String,
    required: false,
  },
  companyName: {
    type: String,
    required: false,
  },
  salary: {
    type: String,
    required: false,
  },
});

const Notifications = new mongoose.model("Notifications", NotificationSchema);
module.exports = Notifications;
