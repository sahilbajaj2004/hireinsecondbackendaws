const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const ContactSchema = Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: false,
  },
  queries: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const ContactsInquiries = new mongoose.model(
  "ContactsInquiries",
  ContactSchema
);
module.exports = ContactsInquiries;
