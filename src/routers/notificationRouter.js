const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const {
  getNotification,
  getNotificationUnreadCount,
  deleteNotification,
  updateNotification,
  clearNotification,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/getNotification", userAuthorization, getNotification);
router.get("/getNotificationUnreadCount", userAuthorization, getNotificationUnreadCount);
router.post("/deleteNotification", userAuthorization, deleteNotification);
router.post("/updateNotification", userAuthorization, updateNotification);
router.post("/clearNotification", userAuthorization, clearNotification);

module.exports = router;
