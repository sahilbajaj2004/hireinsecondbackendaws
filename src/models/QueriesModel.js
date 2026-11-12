const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const QueriesSchema = Schema({
  jobType: {
    type: String,
    required: true,
  },
  budget: {
    type: String,
    required: true,
  },
  noOfDays: {
    type: String,
    required: false,
  },
  skills: {
    type: [String],
    required: true,
  },
  currency: {
    type: [String],
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const QueriesModel = new mongoose.model("QueriesModel", QueriesSchema);
module.exports = QueriesModel;
