const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const {
  createOrder,
  verifyOrder,
  getPaymentHistory,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/createOrder", userAuthorization, createOrder);
router.post("/verifyOrder", userAuthorization, verifyOrder);
router.get("/getPaymentHistory", userAuthorization, getPaymentHistory);

module.exports = router;
