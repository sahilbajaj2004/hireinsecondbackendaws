const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const SavedJobsSchema = Schema({
  jobId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  isSaved: {
    type: Boolean,
    required: true,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const SavedJobs = new mongoose.model("SavedJobs", SavedJobsSchema);
module.exports = SavedJobs;
