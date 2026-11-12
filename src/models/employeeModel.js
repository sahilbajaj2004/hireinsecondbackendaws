const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const EmployeeOnboardingSchema = Schema({
  companyId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  skills: {
    type: String,
    required: true,
  },
  exprience: {
    type: String,
    required: true,
  },
  joiningEstimate: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
  },
  budget: {
    type: String,
    required: true,
  },
  resume: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "ACTIVE",
  },
  paymentType: {
    type: String,
    required: false,
  },
  alloted: {
    type: Boolean,
    default: false,
  },
  salary: {
    type: Number,
  },
  profilePic: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  applicationCount: {
    type: Number,
    default: 0,
  },
  lastApplicationAt: {
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

const EmployeeOnboarding = new mongoose.model(
  "EmployeeOnboarding",
  EmployeeOnboardingSchema
);
module.exports = EmployeeOnboarding;
