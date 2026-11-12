const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const LanguageSchema = Schema({
  msgId: {
    type: String,
    required: true,
    unique: true,
  },
  EN: {
    type: String,
    required: true,
  },
  ARABIC: {
    type: String,
    required: false,
  },
  CH: {
    type: String,
    required: true,
  },
  TH: {
    type: String,
    required: false,
  },
  KR: {
    type: String,
    required: false,
  },
  Category: {
    type: String,
    required: false,
  },
});

const LocalizationMaster = new mongoose.model(
  "LocalizationMaster",
  LanguageSchema
);
module.exports = LocalizationMaster;
