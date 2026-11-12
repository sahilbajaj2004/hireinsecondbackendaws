const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const ReSheduleSchema = Schema({
  interviewId: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  newTimeStart: {
    type: String,
    required: true,
  },
  newEndTime: {
    type: String,
    required: false,
  },
  isAccepted: {
    type: String,
    default: "N/A",
  },
  rejectedReason: {
    type: String,
    default: "",
  },
  rejectedType: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const ReSheduleInterview = new mongoose.model(
  "ReSheduleInterview",
  ReSheduleSchema
);
module.exports = ReSheduleInterview;
