const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EmailBroadcastLogSchema = new Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    target: {
      type: String,
      enum: ["all", "jobseekers", "clients", "partners", "single"],
      required: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    targetUserName: {
      type: String,
      default: null,
    },
    targetUserEmail: {
      type: String,
      default: null,
    },
    totalTargeted: {
      type: Number,
      default: 0,
    },
    deliveredCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    status: {
      type: String,
      enum: ["DELIVERED", "PARTIAL", "FAILED"],
      default: "DELIVERED",
    },
    errorLogs: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailBroadcastLog", EmailBroadcastLogSchema);
