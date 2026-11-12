const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const NewsLetterSchema = Schema({
  email: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const NewsLetter = new mongoose.model("NewsLetter", NewsLetterSchema);
module.exports = NewsLetter;
