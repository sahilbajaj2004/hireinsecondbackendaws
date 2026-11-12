const Payment = require("../models/paymentModel");
const Razorpay = require("razorpay");
var crypto = require("crypto");
const { USER_TYPES } = require("../constants/constants");

var instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrder = async (req, res) => {
  try {
    const { amount, currency, vendorId, employeeId, clientId, jobId } =
      req.body;

    var options = {
      amount: amount * 100, // amount in the smallest currency unit
      currency: currency,
      receipt: "order_rcptid_11",
    };
    instance.orders.create(options, async function (err, order) {
      console.log(order, "orders");
      // `err` used to be ignored and the Payment.create rejection was an
      // unhandled rejection inside a callback: the request then never got a
      // response. Answer every path.
      if (err) {
        console.log("razorpay error ==>> ", err);
        return res.status(400).json({ success: false, message: err?.error?.description || "Order creation failed" });
      }
      try {
        const userObj = await Payment.create({
          amount,
          currency,
          vendorId,
          employeeId,
          clientId,
          jobId,
        });
        userObj.orderId = order.id;
        await userObj.save();
        res.status(200).json({
          success: true,
          message: "User added successfully",
          data: order,
        });
      } catch (dbErr) {
        console.log("payment save error ==>> ", dbErr);
        res.status(400).json({ success: false, message: dbErr?.message || "Order save failed" });
      }
    });
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const verifyOrder = async (req, res) => {
  // STEP 7: Receive Payment Data
  const { order_id, payment_id } = req.body;
  const razorpay_signature =
    req.headers["x-razorpay-signature"] || req.headers["X-Razorpay-Signature"];
  console.log(req.headers, "req.headers");

  // Pass yours key_secret here
  const key_secret = process.env.RAZORPAY_KEY_SECRET || "AwKcEhtm6LPlhH9F6OOB0BKn";

  // STEP 8: Verification & Send Response to User

  // Creating hmac object
  let hmac = crypto.createHmac("sha256", key_secret);

  // Passing the data to be hashed
  hmac.update(order_id + "|" + payment_id);

  // Creating the hmac in the required format
  const generated_signature = hmac.digest("hex");
  console.log(generated_signature);
  if (razorpay_signature === generated_signature) {
    const data = await Payment.findOne({ orderId: order_id });
    console.log(data);
    if (data) {
      data.paymentId = payment_id;
      data.paymentStatus = "SUCCESS";
      await data.save();
    }
    res
      .status(200)
      .json({ success: true, message: "Payment has been verified" });
  } else
    res
      .status(500)
      .json({ success: false, message: "Payment verification failed" });
};

const getPaymentHistory = async (req, res) => {
  const clientId = req.query.clientId;
  const jobId = req.query.jobId;
  const employeeId = req.query.employeeId;
  const userType = req.query.userType;

  try {
    const data = await Payment.find({
      clientId: clientId,
      jobId: jobId,
      employeeId: employeeId,
      paymentStatus: "SUCCESS",
    });
    console.log(data, "dayta");
    if (data && data.length > 0) {
      let newarr = [];
      data.forEach((item) => {
        if (userType === USER_TYPES.CLIENT) {
          newarr.push({
            clientId: item.clientId,
            jobId: item.jobId,
            employeeId: item.employeeId,
            paymentStatus: item.paymentStatus,
            amount: item.amount,
            currency: item.currency,
            paidOn: item.paidOn,
            paymentId: item.paymentId,
          });
        } else {
          newarr.push({
            clientId: item.clientId,
            jobId: item.jobId,
            employeeId: item.employeeId,
            employeePaymentStatus: item.employeePaymentStatus,
            employeeAmount: item.employeeAmount,
            currency: item.currency,
            paidOn: item.paidOn,
            paymentId: item.paymentId,
          });
        }
      });

      res.status(200).json({
        success: true,
        message: "Successfully fetched data",
        data: newarr,
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No data found",
        data: data,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error?.message || error,
    });
  }
};
module.exports = {
  createOrder,
  verifyOrder,
  getPaymentHistory,
};
