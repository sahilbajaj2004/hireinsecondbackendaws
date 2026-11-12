/**
 * TRAI DLT-Compliant SMS Gateway Service for Indian Telecom Regulations.
 * Supports: Fast2SMS (DLT / OTP route), Textlocal, Gupshup.
 * AUTH-03 requirement: Registered TRAI DLT Entity ID, Sender Header, pre-approved Template ID.
 */

const axios = require("axios");
const { validateAndParseIndianMobile } = require("../helpers/phoneHelper");

/**
 * Dispatches an OTP SMS via the configured TRAI DLT-compliant gateway.
 * @param {string} rawPhone Mobile number (will be parsed to 10 digits / E.164)
 * @param {string|number} otp The 6-digit numeric OTP code
 * @returns {Promise<{ success: boolean, gateway: string, response?: any, error?: string }>}
 */
async function sendDltOtp(rawPhone, otp) {
  const parsed = validateAndParseIndianMobile(rawPhone);
  const targetNumber = parsed.isValid ? parsed.digits : String(rawPhone).replace(/\D/g, "");

  const gateway = (process.env.SMS_GATEWAY || "fast2sms").toLowerCase();
  const dltEntityId = process.env.DLT_ENTITY_ID || "";
  const dltSenderId = process.env.DLT_SENDER_ID || "HIREIN";
  const dltTemplateId = process.env.DLT_TEMPLATE_ID || "";

  console.log(
    `[DLT-OTP DISPATCH] Gateway: ${gateway} | Recipient: +91${targetNumber} | OTP: ${otp} | DLT Header: ${dltSenderId} | Template: ${dltTemplateId || "DEFAULT"}`
  );

  // If no live API keys configured (e.g. local dev / test), log clearly and succeed safely
  const fast2SmsKey = process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || "";
  const textlocalKey = process.env.TEXTLOCAL_API_KEY || "";
  const gupshupUser = process.env.GUPSHUP_USERID || "";

  if (!fast2SmsKey && !textlocalKey && !gupshupUser) {
    console.log(
      `[DLT-OTP DEV MODE] No SMS provider API key set in .env. Logged OTP ${otp} for +91${targetNumber}.`
    );
    return { success: true, gateway: "local-dev-mock", simulated: true };
  }

  try {
    switch (gateway) {
      case "fast2sms": {
        // Fast2SMS DLT Route:
        // When template_id is provided, use the DLT route per Fast2SMS v2 specs.
        // Fast2SMS Quick OTP route also supports variables_values=${otp}
        let response;
        if (dltTemplateId) {
          response = await axios.post(
            "https://www.fast2sms.com/dev/bulkV2",
            {
              route: "dlt",
              sender_id: dltSenderId,
              message: dltTemplateId,
              variables_values: String(otp),
              flash: 0,
              numbers: targetNumber,
            },
            {
              headers: {
                authorization: fast2SmsKey,
                "Content-Type": "application/json",
              },
              timeout: 10000,
            }
          );
        } else {
          // Fast2SMS Quick OTP route with DLT header if template not yet approved
          response = await axios.get("https://www.fast2sms.com/dev/bulkV2", {
            params: {
              authorization: fast2SmsKey,
              route: "otp",
              variables_values: String(otp),
              numbers: targetNumber,
              flash: "0",
            },
            timeout: 10000,
          });
        }

        console.log("[Fast2SMS DLT Response]:", response.data);
        return { success: true, gateway: "fast2sms", response: response.data };
      }

      case "textlocal": {
        // Textlocal DLT Gateway
        const message = `Thank you for choosing Hire In Second. Use OTP ${otp} to complete your login. Valid for 5 minutes.`;
        const params = new URLSearchParams({
          apikey: textlocalKey,
          numbers: `91${targetNumber}`,
          message: encodeURIComponent(message),
          sender: dltSenderId,
        });

        if (dltEntityId) params.append("custom", dltEntityId);
        if (dltTemplateId) params.append("template_id", dltTemplateId);

        const response = await axios.post("https://api.textlocal.in/send/", params.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 10000,
        });

        console.log("[Textlocal DLT Response]:", response.data);
        return { success: true, gateway: "textlocal", response: response.data };
      }

      case "gupshup": {
        // Gupshup Enterprise DLT Gateway
        const message = `Thank you for choosing Hire In Second. Use OTP ${otp} to complete your login. Valid for 5 minutes.`;
        const response = await axios.get("https://enterprise.smsgupshup.com/GatewayAuth", {
          params: {
            userid: gupshupUser,
            password: process.env.GUPSHUP_PASSWORD || "",
            send_to: `91${targetNumber}`,
            msg: message,
            method: "sendMessage",
            msg_type: "TEXT",
            format: "json",
            v: "1.1",
            auth_scheme: "plain",
            mask: dltSenderId,
            principalEntityId: dltEntityId,
            dltTemplateId: dltTemplateId,
          },
          timeout: 10000,
        });

        console.log("[Gupshup DLT Response]:", response.data);
        return { success: true, gateway: "gupshup", response: response.data };
      }

      default: {
        console.warn(`[DLT-OTP] Unknown gateway ${gateway}, falling back to console log.`);
        return { success: true, gateway: "unsupported-fallback" };
      }
    }
  } catch (error) {
    const errorDetails = error?.response?.data || error?.message || error;
    console.error(`[DLT-OTP ERROR] Failed to send via ${gateway}:`, errorDetails);
    // Don't throw: allow flow to continue while logging error for operational monitoring
    return { success: false, gateway, error: String(errorDetails) };
  }
}

module.exports = {
  sendDltOtp,
};
