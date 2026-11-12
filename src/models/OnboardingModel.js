const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const OnboardingSchema = Schema({
  onboadingDetails: {
    type: String,
    required: true,
  },
  applicationId: {
    type: String,
    required: true,
  },
  cliendId: {
    type: String,
    required: true,
  },
  notice: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    required: false,
    default: "INACTIVE",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const OnboardingMaster = new mongoose.model(
  "OnboardingMaster",
  OnboardingSchema
);
module.exports = OnboardingMaster;
