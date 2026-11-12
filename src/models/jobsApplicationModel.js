const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const JobsApplicationSchema = Schema({
  companyId: {
    type: String,
    required: true,
  },
  jobId: {
    type: String,
    required: true,
  },
  clientId: {
    type: String,
    required: true,
  },
  resume: {
    type: String,
    required: true,
  },
  employeeId: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    default: "ACTIVE",
  },
  coverNote: {
    type: String,
  },
  portfolioUrl: {
    type: String,
  },
  screeningAnswers: {
    type: Schema.Types.Mixed,
  },
  reason: {
    type: String,
  },
  agreement: {
    type: String,
  },
  budgetPercentage: {
    type: String,
  },
  contractDate: {
    type: String,
  },
  sentAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  viewedAt: {
    type: Date,
  },
  interviewCount: {
    type: Number,
    default: 0,
  },
  lastInterviewAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const JobsApplications = new mongoose.model(
  "JobsApplications",
  JobsApplicationSchema
);
module.exports = JobsApplications;
