const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const JobsSchema = Schema({
  companyId: {
    type: String,
    required: true,
  },
  jobType: {
    type: String,
    required: true,
  },
  isSaved: {
    type: Boolean,
    required: true,
    default: false,
  },
  isApplied: {
    type: Boolean,
    required: true,
    default: false,
  },
  profilePic: {
    type: String,
    default: "",
  },
  jobTitle: {
    type: String,
    required: true,
  },
  jobDescription: {
    type: String,
    required: true,
  },
  jobLocation: {
    type: String,
    required: true,
  },
  positions: {
    type: String,
    required: true,
  },
  functionalArea: {
    type: String,
    required: false,
  },
  requiredSkills: {
    type: String,
    required: true,
  },
  qualification: {
    type: String,
    required: true,
    default: "Any",
  },
  applicationType: {
    type: String,
    default: "Hybrid",
  },
  noticePeriod: {
    type: String,
    required: true,
  },
  budget: {
    type: String,
  },
  isBudgetDisclosed: {
    type: Boolean,
    required: true,
  },
  currency: {
    type: String,
  },
  status: {
    type: String,
    default: "ACTIVE",
  },
  paymentType: {
    type: String,
    required: false,
  },
  experience: {
    type: String,
  },
  commission: {
    type: Number,
  },
  salary: {
    type: Number,
  },
  probabation: {
    type: String,
  },
  country: {
    type: String,
  },
  paymentTerms: {
    type: Number,
  },
  taxTerms: {
    type: String,
    required: false,
  },
  isPremiumClient: {
    type: Boolean,
    required: true,
    default: false,
  },
  isUrgent: {
    type: Boolean,
    default: false,
  },
  selectionType: {
    type: String,
    required: false,
    default: "Phase B",
  },
  companyName: {
    type: String,
    required: false,
  },
  contractDays: {
    type: String,
    required: false,
  },
  replacementDays: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  applicationsCount: {
    type: Number,
    default: 0,
    required: true,
  },
  lastApplicationAt: {
    type: Date,
    required: false,
  },
  interviewCount: {
    type: Number,
    default: 0,
  },
  lastInterviewAt: {
    type: Date,
    required: false,
  },
  displayCompanyName: {
    type: String,
    required: true,
  },
});

const Jobs = new mongoose.model("Jobs", JobsSchema);
module.exports = Jobs;
