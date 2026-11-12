const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const AggreementSchema = Schema({
  applicationId: {
    type: String,
    required: true,
  },
  resourceId: {
    type: String,
    required: true,
  },
  document: {
    type: String,
    required: false,
  },
  status: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const AggreementQuerises = new mongoose.model(
  "AggreementQuerises",
  AggreementSchema
);
module.exports = AggreementQuerises;
