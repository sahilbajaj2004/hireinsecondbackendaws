const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const InviteEmployeeSchema = Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  employeeId: {
    type: String,
  },
  interviewId: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const InviteEmployee = new mongoose.model(
  "InviteEmployee",
  InviteEmployeeSchema
);
module.exports = InviteEmployee;
