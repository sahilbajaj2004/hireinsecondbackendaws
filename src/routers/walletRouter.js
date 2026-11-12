const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const { getStatus, addStatus } = require("../controllers/walletController");

const router = express.Router();

router.get("/getStatus", userAuthorization, getStatus);
router.post("/addStatus", userAuthorization, addStatus);

module.exports = router;
