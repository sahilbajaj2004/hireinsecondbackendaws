const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const InvitationSchema = Schema({
  companyId: {
    type: String,
    required: true,
  },
  jobId: {
    type: String,
    required: false,
  },
  clientId: {
    type: String,
    required: true,
  },
  employeeId: {
    type: String,
    required: false,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "ACTIVE",
  },
  jobName: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const JobsInvitations = new mongoose.model("JobsInvitations", InvitationSchema);
module.exports = JobsInvitations;
