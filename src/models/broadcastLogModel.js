const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BroadcastLogSchema = new Schema(
  {
    title: {
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
    deepLink: {
      type: String,
      default: "",
    },
    totalTargeted: {
      type: Number,
      default: 0,
    },
    tokensCount: {
      type: Number,
      default: 0,
    },
    deliveredCount: {
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
      default: "DELIVERED",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BroadcastLog", BroadcastLogSchema);
