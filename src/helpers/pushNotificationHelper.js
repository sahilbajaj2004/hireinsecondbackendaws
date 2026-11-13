const axios = require("axios");
const User = require("../models/userModel");

/**
 * Dispatches a push notification via Expo Push Notification service.
 * Respects user preferences:
 * - If user.pushNotif === false, NO notification is sent.
 * - If user does not have a registered pushToken, no notification is sent.
 * - If user has pushToken and pushNotif is true/undefined, push notification is sent immediately.
 */
async function sendPushNotification({ userId, title, body, data }) {
  try {
    if (!userId) return null;

    const user = await User.findById(userId).select("pushToken pushNotif firstName lastName email");
    if (!user) return null;

    // Setting check: If the user toggled off push notifications in settings, DO NOT send!
    if (user.pushNotif === false) {
      console.log(`[PushNotification] Skipped push for user ${userId} (Push Notifications disabled in settings)`);
      return { skipped: true, reason: "disabled_by_user" };
    }

    if (!user.pushToken) {
      console.log(`[PushNotification] No pushToken registered for user ${userId}`);
      return { skipped: true, reason: "no_token" };
    }

    // Validate that it's a valid Expo push token
    const token = String(user.pushToken).trim();
    if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
      console.warn(`[PushNotification] Invalid push token format for user ${userId}:`, token);
      return { skipped: true, reason: "invalid_token_format" };
    }

    const payload = {
      to: token,
      sound: "default",
      title: title || "HireInSecond Notification",
      body: body || "",
      data: data || {},
      priority: "high",
      channelId: "default",
      color: "#48a7bb",
    };

    console.log(`[PushNotification] Dispatching push to user ${userId} (${token}):`, title);

    const response = await axios.post("https://exp.host/--/api/v2/push/send", payload, {
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    console.log(`[PushNotification] Expo response for user ${userId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`[PushNotification] Failed to send push to user ${userId}:`, error?.message);
    return null;
  }
}

module.exports = {
  sendPushNotification,
};
