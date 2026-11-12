const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const MettingSchema = Schema({
  clientId: {
    type: String,
    required: true,
  },
  jobId: {
    type: String,
    required: true,
  },
  employeeId: {
    type: String,
    required: true,
  },
  jobTitle: {
    type: String,
    required: false,
  },
  meetingStartTime: {
    type: String,
    required: true,
  },
  meetingEndTime: {
    type: String,
    required: false,
  },
  assignee: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    default: "ACTIVE",
  },
  description: {
    type: String,
  },
  title: {
    type: String,
  },
  applicationId: {
    type: String,
  },
  password: {
    type: String,
  },
  timezone: {
    type: String,
  },
  duration: {
    type: String,
  },
  meetingLink: {
    type: String,
  },
  joinUrl: {
    type: String,
  },
  startUrl: {
    type: String,
  },
  interviewers: {
    type: String,
  },
  candidate: {
    type: String,
  },
  profilePic: {
    type: String,
  },
  meetingId: {
    type: String,
  },
  reason: {
    type: String,
    default: "",
  },
  isAccepted: {
    type: String,
    default: "N/A",
  },
  interviewRejectedReason: {
    type: String,
  },
  feedback: {
    type: String,
    // default:""
  },
  aiSummary: {
    type: Schema.Types.Mixed,
    default: null,
  },
  transcript: {
    type: Schema.Types.Mixed,
    default: null,
  },
  transcriptStatus: {
    type: String,
    enum: ["PENDING", "PROCESSING", "READY", "FAILED"],
    default: "PENDING",
  },
  isPendingRequest: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const JobsInterview = new mongoose.model("JobsInterview", MettingSchema);
module.exports = JobsInterview;
