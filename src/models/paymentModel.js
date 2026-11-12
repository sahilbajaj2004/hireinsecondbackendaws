const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const PaymentSchema = Schema({
  orderId: {
    type: String,
    required: false,
  },
  clientId: {
    type: String,
    required: false,
  },
  paymentId: {
    type: String,
    required: false,
  },
  paymentStatus: {
    type: String,
    required: false,
    default: "READ",
  },
  employeeId: {
    type: String,
    required: false,
  },
  vendorId: {
    type: String,
    required: false,
  },
  currency: {
    type: String,
  },
  amount: {
    type: String,
  },
  employeeAmount: {
    type: String,
    required: false,
  },
  jobId: {
    type: String,
    required: false,
  },
  employeePaymentStatus: {
    type: String,
    required: false,
    default: "INITIATED",
  },
  paidOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
});

const Payment = new mongoose.model("Payment", PaymentSchema);
module.exports = Payment;
