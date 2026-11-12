/**
 * Helper for validating Indian mobile numbers and formatting to standard E.164.
 * Rule: 10 digits starting with 6, 7, 8, or 9 (^[6-9]\d{9}$)
 * E.164 standard: +91XXXXXXXXXX
 */

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Validates and normalizes an Indian phone number.
 * @param {string|number} raw
 * @returns {{ isValid: boolean, digits: string, e164: string, error?: string }}
 */
function validateAndParseIndianMobile(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return {
      isValid: false,
      digits: "",
      e164: "",
      error: "Phone number is required.",
    };
  }

  let clean = String(raw).trim().replace(/[^\d+]/g, "");

  // Strip international prefix if provided
  if (clean.startsWith("+91")) {
    clean = clean.slice(3);
  } else if (clean.startsWith("91") && clean.length === 12) {
    clean = clean.slice(2);
  } else if (clean.startsWith("0") && clean.length === 11) {
    clean = clean.slice(1);
  }

  const digits = clean.replace(/\D/g, "");

  if (digits.length === 0) {
    return {
      isValid: false,
      digits: "",
      e164: "",
      error: "Phone number is required.",
    };
  }

  if (digits.length < 10) {
    return {
      isValid: false,
      digits,
      e164: digits ? `+91${digits}` : "",
      error: `Phone number is incomplete (${digits.length}/10 digits).`,
    };
  }

  if (digits.length > 10) {
    return {
      isValid: false,
      digits,
      e164: `+91${digits}`,
      error: "Phone number cannot exceed 10 digits.",
    };
  }

  if (!INDIAN_MOBILE_REGEX.test(digits)) {
    return {
      isValid: false,
      digits,
      e164: `+91${digits}`,
      error: "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
    };
  }

  return {
    isValid: true,
    digits,
    e164: `+91${digits}`,
  };
}

/**
 * Builds a dual lookup query for MongoDB to match both normalized E.164 and legacy 10-digit representations.
 * @param {string} rawPhone
 * @returns {object} { $in: [...] }
 */
function buildPhoneQuery(rawPhone) {
  const parsed = validateAndParseIndianMobile(rawPhone);
  if (parsed.digits) {
    return { $in: [parsed.e164, parsed.digits, String(rawPhone).trim()] };
  }
  return String(rawPhone).trim();
}

module.exports = {
  INDIAN_MOBILE_REGEX,
  validateAndParseIndianMobile,
  buildPhoneQuery,
};
