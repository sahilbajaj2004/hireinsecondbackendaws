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
      _displayInForeground: true,
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

/**
 * Dispatches an array of pre-filtered Expo push notifications in chunks of 100.
 * @param {Array<{ to: string, title: string, body: string, data?: object }>} messages
 * @returns {Promise<{ deliveredCount: number, errorCount: number, tickets: Array }>}
 */
async function sendBatchPushNotifications(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { deliveredCount: 0, errorCount: 0, tickets: [] };
  }

  // Filter valid tokens only
  const validMessages = messages
    .filter((m) => {
      const token = String(m?.to || "").trim();
      return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
    })
    .map((m) => ({
      to: String(m.to).trim(),
      sound: "default",
      title: m.title || "HireInSecond Notification",
      body: m.body || "",
      data: m.data || {},
      priority: "high",
      channelId: "default",
      color: "#48a7bb",
      _displayInForeground: true,
    }));

  if (validMessages.length === 0) {
    return { deliveredCount: 0, errorCount: 0, tickets: [] };
  }

  const CHUNK_SIZE = 100;
  let deliveredCount = 0;
  let errorCount = 0;
  const allTickets = [];

  for (let i = 0; i < validMessages.length; i += CHUNK_SIZE) {
    const chunk = validMessages.slice(i, i + CHUNK_SIZE);
    try {
      const response = await axios.post("https://exp.host/--/api/v2/push/send", chunk, {
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });

      if (response.data && Array.isArray(response.data.data)) {
        response.data.data.forEach((ticket) => {
          if (ticket.status === "ok") {
            deliveredCount++;
          } else {
            errorCount++;
          }
          allTickets.push(ticket);
        });
      } else {
        deliveredCount += chunk.length;
      }
    } catch (err) {
      console.error("[PushNotification] Error sending Expo push chunk:", err?.message);
      errorCount += chunk.length;
    }
  }

  console.log(
    `[PushNotification] Batch completed: ${deliveredCount} delivered, ${errorCount} errors out of ${validMessages.length} total.`
  );
  return { deliveredCount, errorCount, tickets: allTickets };
}

module.exports = {
  sendPushNotification,
  sendBatchPushNotifications,
};
