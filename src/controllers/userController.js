const { default: axios } = require("axios");
const mongoose = require("mongoose");
const { USER_TYPES, KYC_STATUS_LIST } = require("../constants/constants");
const generateToken = require("../functions/jwtHelper");
const { generateNumericOtp, sendEmail } = require("../functions/utils");
const Users = require("../models/userModel");
const User = require("../models/userModel");
const { sendDltOtp } = require("../services/smsService");
const { validateAndParseIndianMobile, buildPhoneQuery } = require("../helpers/phoneHelper");
const { checkRoleConflict } = require("../helpers/roleHelper");

const { verifyMessage } = require("ethers");
const TempUser = require("../models/tempUserModel");
const verifyRecaptcha = require("../helpers/verifyRecaptcha");
const bcrypt = require("bcryptjs");
const EmployeeOnboarding = require("../models/employeeModel");
const JobsApplication = require("../models/jobsApplicationModel");
const Notifications = require("../models/notificatonModel");
const fs = require("fs/promises");
const { parsePdfResume } = require("../helpers/resumeParser");
const {
  cleanSkills,
  sanitizeExperiences,
  sanitizeEducation,
  generateStandardizedResumeHtml,
} = require("../helpers/resumeFormatter");

let activeResumeParses = 0;

const normalizeConnectedAccounts = (raw, user = {}) => {
  let conn = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    conn = { ...raw };
  } else if (typeof raw === "string" && raw.startsWith("{")) {
    try {
      conn = JSON.parse(raw);
    } catch {
      conn = {};
    }
  }

  const hasGoogle = Boolean(user.googleId || conn.google?.id || conn.google?.connected);
  const linkedinVal = user.linkedinUrl || user.linkedin || conn.linkedin?.url || "";
  const githubVal = user.githubUrl || user.github || conn.github?.url || "";
  const portfolioVal = user.portfolioUrl || conn.portfolio?.url || "";

  return {
    google: {
      connected: Boolean(hasGoogle),
      email: conn.google?.email || (hasGoogle ? user.email : "") || "",
      id: user.googleId || conn.google?.id || "",
      connectedAt: conn.google?.connectedAt || (hasGoogle ? user.createdAt : undefined),
    },
    linkedin: {
      connected: Boolean(linkedinVal),
      url: linkedinVal || "",
      username: conn.linkedin?.username || (linkedinVal ? linkedinVal.split("/").filter(Boolean).pop() : "") || "",
      connectedAt: conn.linkedin?.connectedAt || (linkedinVal ? new Date() : undefined),
    },
    github: {
      connected: Boolean(githubVal),
      url: githubVal || "",
      username: conn.github?.username || (githubVal ? githubVal.split("/").filter(Boolean).pop() : "") || "",
      connectedAt: conn.github?.connectedAt || (githubVal ? new Date() : undefined),
    },
    portfolio: {
      connected: Boolean(portfolioVal),
      url: portfolioVal || "",
      connectedAt: conn.portfolio?.connectedAt || (portfolioVal ? new Date() : undefined),
    },
  };
};

const sanitizeUserEmail = (user) => {
  if (!user) return user;
  const target = user._doc ? user._doc : user;
  if (target.email && typeof target.email === "string" && target.email.toLowerCase().endsWith("@phone.hireinsecond.com")) {
    target.email = "";
  }
  if (user.email && typeof user.email === "string" && user.email.toLowerCase().endsWith("@phone.hireinsecond.com")) {
    user.email = "";
  }
  return user;
};

const walletConnect = async (req, res) => {
  const { message, signature, address } = req.body;

  try {
    const recoveredAddress = verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: "Signature mismatch" });
    }

    const timestampLine = message
      .split("\n")
      .find((line) => line.startsWith("Timestamp:"));
    const timestamp = timestampLine?.split("Timestamp:")[1]?.trim();

    if (
      !timestamp ||
      Math.abs(Date.now() - new Date(timestamp).getTime()) > 2 * 60 * 1000
    ) {
      return res.status(400).json({ error: "Signature timestamp expired" });
    }
    const user = await TempUser.findOne({ walletAddress: address });

    if (!user) {
      const data = await TempUser.create({
        walletAddress: address,
      });
      return res.status(200).json({
        token: generateToken({
          address: data.walletAddress,
        }),
      });
    } else {
      return res.status(200).json({
        token: generateToken({
          address: user.walletAddress,
        }),
      });
    }
  } catch (err) {
    console.error("Connect to wallet failed:", err);
    return res.status(400).json({ error: "Invalid signature or message" });
  }
};

const patchDetails = async (req, res) => {
  const { name, phone, email, country } = req.body;
  try {
    const user = await TempUser.findOne({
      walletAddress: req.decodedUser.address,
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.email = email || user.email;
    user.country = country || user.country;

    await user.save();
    return res.status(200).json({
      message: "User details updated successfully",
      data: user,
    });
  } catch (err) {
    console.error("Error updating user details:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
const getUserDetails = async (req, res) => {
  try {
    const user = await TempUser.findOne({
      walletAddress: req.decodedUser.address,
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({
      message: "User details fetched successfully",
      data: user,
    });
  } catch (err) {
    console.error("Error fetching user details:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const sendOtp = async (to, otp) => {
  return await sendDltOtp(to, otp);
};

const register = async (req, res) => {
  try {
    const { captchaToken, type } = req.body;
    if (type !== USER_TYPES.ADMIN) {
      if (!captchaToken) {
        return res.status(400).json({ success: false, msg: "Captcha missing" });
      }
      const isHuman = await verifyRecaptcha(captchaToken);
      if (!isHuman) {
        return res
          .status(400)
          .json({ success: false, msg: "Captcha verification failed" });
      }
    }


    const {
      firstName,
      lastName,
      phone,
      email,
      country,
      password,
      role,
      userType,
      companyName,
      companyRepresentative,
      strengthOfCompany,
      designation,
      exprience,
      countryCode,
      subscriptionStatus,
      skills,
      document,
    } = req.body;

    let normalizedPhone = phone ? phone.trim() : "";
    if (phone) {
      const parsedPhone = validateAndParseIndianMobile(phone);
      if (!parsedPhone.isValid) {
        return res.status(400).json({ success: false, error: parsedPhone.error, message: parsedPhone.error });
      }
      normalizedPhone = parsedPhone.e164;
    }

    const userData = await User.findOne({ email: email });
    if (userData && !userData?.status) {
      console.log(userData);
      userData.firstName = firstName;
      userData.lastName = lastName;
      userData.phone = normalizedPhone;
      userData.email = email;
      userData.country = country;
      userData.password = password;
      userData.role = role;
      userData.userType = userType;
      userData.companyName = companyName;
      userData.companyRepresentative = companyRepresentative;
      userData.strengthOfCompany = strengthOfCompany;
      userData.designation = designation;
      userData.exprience = exprience;
      userData.countryCode = countryCode || "+91";
      userData.otpVerified = false;
      userData.status = true;
      userData.subscriptionStatus = false;
      userData.skills = skills;
      await userData.save();
      const userData2 = await User.findOne({ email: email });
      if (userData2) {
        let response = {};
        res.status(200).json({
          success: true,
          data: userData2?._id,
        });
      }
    } else if (userData && userData.status) {
      const conflictMsg = checkRoleConflict(userData.userType, userType);
      if (conflictMsg) {
        return res.status(400).json({
          success: false,
          code: "ROLE_CONFLICT",
          error: conflictMsg,
          message: conflictMsg,
        });
      }
      res
        .status(400)
        .json({ success: false, error: "An account with this email already exists." });
    } else {
      let isProfileCompleted = false;
      switch (userType) {
        case USER_TYPES.CLIENT:
          if (firstName && lastName && companyName && designation && email && country && countryCode && phone) {
            isProfileCompleted = true;
          }
          break;
        case USER_TYPES.PERSONAL:
          if (firstName && lastName && email && country && countryCode && phone && skills && exprience) {
            isProfileCompleted = true;
          }
          break;
        case USER_TYPES.COMPANY:
          if (firstName && lastName && email && country && countryCode && phone && companyName && strengthOfCompany && designation) {
            isProfileCompleted = true;
          }
          break;
        case USER_TYPES.INDIVIDUAL:
          if (firstName && lastName && email && country && countryCode && phone) {
            isProfileCompleted = true;
          }
          break;
        default:
          isProfileCompleted = false;
          break;
      }

      const userObj = await User.create({
        firstName,
        lastName,
        phone: normalizedPhone,
        email,
        country,
        countryCode: countryCode || "+91",
        password,
        role,
        userType,
        companyName,
        companyRepresentative,
        strengthOfCompany,
        designation,
        exprience,
        skills,
        subscriptionStatus,
        document: document ?? "",
        isProfileCompleted,
      });
      if (userObj) {
        let response = {};
        res.status(200).json({
          success: true,
          data: userObj?._id,
        });
      }
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const registerMobile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      userType,
      phone,
      companyName,
    } = req.body;

    if (!email || !password || !firstName || !lastName || !userType) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email, password, and user type are required.",
      });
    }

    let normalizedPhone = "";
    if (phone) {
      const parsedPhone = validateAndParseIndianMobile(phone);
      if (!parsedPhone.isValid) {
        return res.status(400).json({
          success: false,
          message: parsedPhone.error,
          error: parsedPhone.error,
        });
      }
      normalizedPhone = parsedPhone.e164;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing && existing.status) {
      const conflictMsg = checkRoleConflict(existing.userType, userType);
      if (conflictMsg) {
        return res.status(400).json({
          success: false,
          code: "ROLE_CONFLICT",
          message: conflictMsg,
          error: conflictMsg,
        });
      }
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    let user;
    if (existing && !existing.status) {
      existing.firstName = firstName.trim();
      existing.lastName = lastName.trim();
      existing.password = password;
      existing.userType = userType;
      if (normalizedPhone) existing.phone = normalizedPhone;
      if (companyName) existing.companyName = companyName.trim();
      existing.otpVerified = false;
      existing.status = true;
      await existing.save();
      user = existing;
    } else {
      user = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password,
        userType,
        phone: normalizedPhone,
        countryCode: "+91",
        companyName: companyName ? companyName.trim() : "",
        otpVerified: false,
        status: true,
        kycStatus: "pending",
        isProfileCompleted: false,
      });
    }

    return res.status(200).json({
      success: true,
      userId: user._id,
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("registerMobile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
      error,
    });
  }
};

const login = async (req, res) => {
  try {
    const userObj = await User.findById(req.userId).select("-password");
    if (userObj.status) {
      res.status(200).json({
        success: true,
        data: sanitizeUserEmail(userObj),
        token: generateToken({ id: userObj._id, userType: userObj.userType }),
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Your account is deactivated, please contact support team",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error,
    });
  }
};
const loginWithMobile = async (req, res) => {
  const { value, key, userType, countryCode } = req.body;
  try {
    const lookupKey = key === "email" ? "email" : "phone";
    const lookupVal =
      lookupKey === "email"
        ? String(value).trim().toLowerCase()
        : String(value).trim();

    let userObj;
    let targetPhoneE164 = "";
    let targetPhoneDigits = "";

    if (lookupKey === "phone") {
      const parsed = validateAndParseIndianMobile(lookupVal);
      if (!parsed.isValid) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE",
          message: parsed.error,
          error: parsed.error,
        });
      }
      targetPhoneE164 = parsed.e164;
      targetPhoneDigits = parsed.digits;
      userObj = await User.findOne({ phone: buildPhoneQuery(parsed.digits) });
    } else {
      userObj = await User.findOne({ email: lookupVal });
    }

    const generatedOtp = generateNumericOtp();

    if (userObj) {
      if (!userObj.status) {
        return res.status(401).json({
          success: false,
          message: "Your account is deactivated, please contact support team",
        });
      }

      if (userType) {
        const conflictMsg = checkRoleConflict(userObj.userType, userType);
        if (conflictMsg) {
          return res.status(400).json({
            success: false,
            code: "ROLE_CONFLICT",
            message: conflictMsg,
            error: conflictMsg,
          });
        }
      }

      userObj.otp = generatedOtp;
      await userObj.save();

      if (lookupKey === "phone") {
        await sendOtp(userObj?.phone || targetPhoneE164, generatedOtp);
      }

      if (
        (lookupKey === "email" || !userObj.phone) &&
        userObj.email &&
        userObj.email.includes("@") &&
        !userObj.email.endsWith("@phone.hireinsecond.com")
      ) {
        console.log(
          `[OTP DISPATCH EMAIL] Recipient: ${userObj.email} | Code: ${generatedOtp}`
        );
        const payload = {
          subject: "Hire In Second OTP",
          emailbody: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
          <div style="margin:50px auto;width:70%;padding:20px 0">
            <div style="border-bottom:1px solid #eee">
              <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Hire In Second</a>
            </div>
            <p style="font-size:1.1em">Hi, ${userObj?.firstName || "there"}</p>
            <p>Thank you for choosing Hire In Second. Use the following OTP to complete your login procedures. OTP is valid for 5 minutes</p>
            <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${generatedOtp}</h2>
            <p style="font-size:0.9em;">Regards,<br />Hire In Second</p>
            <hr style="border:none;border-top:1px solid #eee" />
          </div>
        </div>`,
          bodyType: "html",
          toEmail: userObj.email,
        };
        await sendEmail(payload).catch((err) => {
          console.error("sendEmail error:", err?.message || err);
        });
      }

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        userId: userObj._id,
        isNew: false,
      });
    } else {
      // Auto-create provisional account for instant mobile phone login/signup
      if (lookupKey === "phone" && lookupVal) {
        const cleanPhone = targetPhoneE164 || `+91${targetPhoneDigits}`;
        const role = userType || "client";
        userObj = await User.create({
          phone: cleanPhone,
          countryCode: countryCode || "+91",
          userType: role,
          otp: generatedOtp,
          otpVerified: false,
          isProfileCompleted: false,
          status: true,
          email: null,
        });

        await sendOtp(cleanPhone, generatedOtp);

        return res.status(200).json({
          success: true,
          message: "OTP sent successfully",
          userId: userObj._id,
          isNew: true,
        });
      }

      // Auto-create provisional account for instant email login/signup
      if (lookupKey === "email" && lookupVal) {
        const cleanEmail = lookupVal;
        const role = userType || "client";
        userObj = await User.create({
          email: cleanEmail,
          userType: role,
          otp: generatedOtp,
          otpVerified: false,
          isProfileCompleted: false,
          status: true,
        });

        console.log(
          `[OTP DISPATCH EMAIL NEW USER] Recipient: ${cleanEmail} | Code: ${generatedOtp}`
        );

        const payload = {
          subject: "Hire In Second OTP",
          emailbody: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
          <div style="margin:50px auto;width:70%;padding:20px 0">
            <div style="border-bottom:1px solid #eee">
              <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Hire In Second</a>
            </div>
            <p style="font-size:1.1em">Hi there,</p>
            <p>Thank you for choosing Hire In Second. Use the following OTP to complete your registration. OTP is valid for 5 minutes</p>
            <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${generatedOtp}</h2>
            <p style="font-size:0.9em;">Regards,<br />Hire In Second</p>
            <hr style="border:none;border-top:1px solid #eee" />
          </div>
        </div>`,
          bodyType: "html",
          toEmail: cleanEmail,
        };
        await sendEmail(payload).catch((err) => {
          console.error("sendEmail error:", err?.message || err);
        });

        return res.status(200).json({
          success: true,
          message: "OTP sent successfully",
          userId: userObj._id,
          isNew: true,
        });
      }

      return res.status(401).json({
        success: false,
        message: "No account found",
      });
    }
  } catch (error) {
    console.error("loginWithMobile error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || error,
    });
  }
};

const generateOtp = async (req, res) => {
  const generatedOtp = generateNumericOtp();
  try {
    let otpType = "";
    const { userId, type, email, newEmail, phone } = req.body;
    switch (type) {
      case "signUp":
        otpType = "Sign Up";
        break;
      case "delete":
        otpType = "Delete";
        break;
      case "resetPassword":
        otpType = "Reset Password";
        break;
      case "editProfile":
        otpType = "Edit Profile";
        break;
    }
    let user;
    if (type === "resetPassword" || type === "editProfile") {
      let filter = phone ? { phone: buildPhoneQuery(phone) } : { email: email };
      user = await User.findOne(filter);
    } else {
      user = await User.findById(userId);
    }

    user.otp = generatedOtp;

    const savedUser = await user.save();
    const payload = {
      subject: "Hire In Second OTP",
      emailbody: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
      <div style="margin:50px auto;width:70%;padding:20px 0">
        <div style="border-bottom:1px solid #eee">
          <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Hire In Second</a>
        </div>
        <p style="font-size:1.1em">Hi,${user?.firstName}</p>
        <p>Thank you for choosing Hire In Second. Use the following OTP to complete your ${otpType} procedures. OTP is valid for 5 minutes</p>
        <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${generatedOtp}</h2>
        <p style="font-size:0.9em;">Regards,<br />Hire In Second</p>
        <hr style="border:none;border-top:1px solid #eee" />
      </div>
    </div>`,
      bodyType: "html",
      toEmail: `${type === "editProfile" ? newEmail : user.email}`,
    };
    await sendOtp(user?.phone, generatedOtp);
    await sendEmail(payload);
    return res.status(200).json({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error,
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { userId, otp, type, email, phone } = req.body;
    let user;
    if (type === "resetPassword") {
      let filter = phone ? { phone: buildPhoneQuery(phone) } : { email: email };
      user = await User.findOne(filter);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.otp === otp) {
      user.otpVerified = true;
      if (type === "delete") {
        user.status = false;
      }
      await user.save();

      if (req.body.userType) {
        const conflict = checkRoleConflict(user.userType, req.body.userType);
        if (conflict) {
          return res.status(400).json({
            success: false,
            code: "ROLE_CONFLICT",
            message: conflict,
          });
        }
      }
      if (type === "signUp" && user.email && !user.email.endsWith("@phone.hireinsecond.com")) {
        const payload = {
          subject: "Welcome to Hire In Second",
          emailbody: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
          "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html xmlns="http://www.w3.org/1999/xhtml"><head><meta content="text/html; charset=utf-8" http-equiv="Content-Type"><meta content="width=device-width, initial-scale=1" name="viewport"><title>Hire In Second Welcome Email</title><!-- Designed by https://github.com/kaytcat --><!-- Robot header image designed by Freepik.com --><style type="text/css">
            @import url(https://fonts.googleapis.com/css?family=Nunito);
          
            /* Take care of image borders and formatting */
          
            img {
              max-width: 600px;
              outline: none;
              text-decoration: none;
              -ms-interpolation-mode: bicubic;
            }
            html{
              margin: 0;
              padding:0;
            }
          
            a {
              text-decoration: none;
              border: 0;
              outline: none;
              color: #bbbbbb;
            }
          
            a img {
              border: none;
            }
          
            /* General styling */
          
            td, h1, h2, h3  {
              font-family: Helvetica, Arial, sans-serif;
              font-weight: 400;
            }
          
            td {
              text-align: center;
            }
          
            body {
              -webkit-font-smoothing:antialiased;
              -webkit-text-size-adjust:none;
              width: 100%;
              height: 100%;
              color: #666;
              background: #fff;
              font-size: 16px;
              height: 100vh;
              width: 100%;
              padding: 0px;
              margin: 0px;
            }
          
             table {
              border-collapse: collapse !important;
            }
          
            .headline {
              color: #444;
              font-size: 36px;
            }
          
           .force-full-width {
            width: 100% !important;
           }
          
          
            </style><style media="screen" type="text/css">
                @media screen {
                  td, h1, h2, h3 {
                    font-family: 'Nunito', 'Helvetica Neue', 'Arial', 'sans-serif' !important;
                  }
                }
            </style><style media="only screen and (max-width: 480px)" type="text/css">
              /* Mobile styles */
              @media only screen and (max-width: 480px) {
          
                table[class="w320"] {
                  width: 320px !important;
                }
              }
            </style>
            <style type="text/css"></style>
            
            </head>
            <body bgcolor="#fff" class="body" style="padding:20px; margin:0; display:block; background:#ffffff; -webkit-text-size-adjust:none">
          <table align="center" cellpadding="0" cellspacing="0" height="100%" width="100%">
          <tbody><tr>
          <td align="center" bgcolor="#fff" class="" valign="top" width="100%">
          <center class=""><table cellpadding="0" cellspacing="0" class="w320" style="margin: 0 auto;" width="600">
          <tbody><tr>
          <td align="center" class="" valign="top"><table cellpadding="0" cellspacing="0" style="margin: 0 auto;" width="100%">
          </table>
          <table bgcolor="#fff" cellpadding="0" cellspacing="0" class="" style="margin: 0 auto; width: 100%; margin-top: 100px;">
          <tbody style="margin-top: 15px;">
            <tr class="">
          <td class="">
          <img alt="robot picture" class="" height="155" src="http://127.0.0.1:5173/src/assets/images/login-4.png" width="155">
          </td>
          </tr>
          <tr class=""><td class="headline">Welcome to Hire In Second! 🎊 🎉 </td></tr>
          <tr>
          <td>
          <center class=""><table cellpadding="0" cellspacing="0" class="" style="margin: 0 auto;" width="75%"><tbody class=""><tr class="">
          <td class="" style="color:#444; font-weight: 400;"><br><br>
          Connecting Talent, Bench, and Opportunity - Your One-Stop Platform for Jobs, Bench, and Talent Acquisition. <br><br>
            You have successfully been registered to use Hire In Second as a <em>${user.userType.toUpperCase()} 😍</em><br>
          <br><br>  
          <br></td>
          </tr>
          </tbody></table></center>
          </td>
          </tr>
          <tr>
          <td class="">
          <div class="">
          <a style="background-color:#674299;border-radius:4px;color:#fff;display:inline-block;font-family:Helvetica, Arial, sans-serif;font-size:18px;font-weight:normal;line-height:50px;text-align:center;text-decoration:none;width:350px;-webkit-text-size-adjust:none;" href="https://hireinsecond.com">Visit Account and Start Connecting 😍</a>
          </div>
           <br>
          </td>
          </tr>
          </tbody>
            
            </table>
          
          <table bgcolor="#fff" cellpadding="0" cellspacing="0" class="force-full-width" style="margin: 0 auto; margin-bottom: 5px:">
          <tbody>
          <tr>
          <td class="" style="color:#444;
                              ">
            </td>
          </tr>
          </tbody></table></td>
          </tr>
          </tbody></table></center>
          </td>
          </tr>
          </tbody></table>
          </body></html>`,
          bodyType: "html",
          toEmail: `${user.email}`,
        };
        await sendEmail(payload);
      }
      return res.status(200).json({
        success: true,
        message: "Verification successfull",
        data: sanitizeUserEmail(user),
        token: generateToken({ id: user._id, userType: user.userType }),
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error,
    });
  }
};

const editProfile = async (req, res) => {
  const {
    firstName,
    lastName,
    phone,
    email,
    country,
    role,
    userType,
    companyName,
    companyRepresentative,
    strengthOfCompany,
    designation,
    exprience,
    countryCode,
    newEmail,
    profilePic,
    kycStatus,
    skills,
    document,
    subscriptionStatus,
    linkedinUrl,
    githubUrl,
    portfolioUrl,
    connectedAccounts,
  } = req.body;
  try {
    let user = await User.findOne({ email: email });
    console.log({
      firstName,
      lastName,
      phone,
      email,
      country,
      role,
      userType,
      companyName,
      companyRepresentative,
      strengthOfCompany,
      designation,
      exprience,
      countryCode,
      newEmail,
      profilePic,
      kycStatus,
      document,
    });
    console.log(user);
    user.firstName = firstName ?? "";
    user.lastName = lastName;
    user.phone = phone;
    // user.email = email;
    user.country = country;
    user.role = role;
    user.userType = userType;
    user.companyName = companyName;
    user.companyRepresentative = companyRepresentative;
    user.strengthOfCompany = strengthOfCompany;
    user.designation = designation;
    const finalExperience = exprience !== undefined ? exprience : req.body.experience;
    if (finalExperience !== undefined) user.exprience = finalExperience;
    user.countryCode = countryCode;
    user.profilePic = profilePic;
    user.kycStatus = kycStatus;
    user.skills = skills;
    user.document = document;
    user.subscriptionStatus = subscriptionStatus;

    if (linkedinUrl !== undefined || req.body.linkedin !== undefined) {
      const val = linkedinUrl !== undefined ? linkedinUrl : req.body.linkedin;
      user.linkedinUrl = val;
      user.linkedin = val;
    }
    if (githubUrl !== undefined || req.body.github !== undefined) {
      const val = githubUrl !== undefined ? githubUrl : req.body.github;
      user.githubUrl = val;
      user.github = val;
    }
    if (portfolioUrl !== undefined) {
      user.portfolioUrl = portfolioUrl;
    }
    if (connectedAccounts !== undefined) {
      const normalizedCurrent = normalizeConnectedAccounts(user.connectedAccounts, user);
      user.connectedAccounts = { ...normalizedCurrent, ...(typeof connectedAccounts === "object" ? connectedAccounts : {}) };
    }

    if (newEmail && newEmail !== email) {
      user.email = newEmail;
    }
    let isProfileCompleted = user.isProfileCompleted || false;
    if (req.body.isProfileCompleted !== undefined) {
      isProfileCompleted = Boolean(req.body.isProfileCompleted);
    } else {
      switch (userType) {
        case USER_TYPES.CLIENT:
        case USER_TYPES.COMPANY:
          if (user.companyName && (user.designation || user.role)) {
            isProfileCompleted = true;
          }
          break;
        case USER_TYPES.PERSONAL:
        case USER_TYPES.INDIVIDUAL:
          if (user.skills && (user.exprience || user.role)) {
            isProfileCompleted = true;
          }
          break;
        default:
          isProfileCompleted = user.isProfileCompleted || false;
          break;
      }
    }
    user.isProfileCompleted = isProfileCompleted;

    await user.save();
    const userObj = await User.findOne({ email: newEmail || email }).select(
      "-password"
    );
    return res.status(200).json({
      success: true,
      message: "Successfully Updated",
      data: userObj,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error,
    });
  }
};
const updateProfile = async (req, res) => {
  const { document } = req.body;
  if (!document) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
  try {
    let user = await User.findById(req.user._id);

    user.kycStatus = KYC_STATUS_LIST.INPROGRESS;

    user.document = document;
    await user.save();

    const notifications = await Notifications.create({
      userId: user._id,
      type: `KYC_${user.userType.toUpperCase()}`,
      notificationDetail: user._id,
      title: "URGENT: KYC Review Needed",
      details: `A new ${user.userType === "company" ? "vendor company" : user.userType === "individual" ? "vendor individual" : "client"} ${(user?.userType === "company" || user.userType === "individual") ? "with the representative" : ""} (${user?.firstName + " " + user?.lastName}) has submitted their KYC, please review and approve or reject it`,
    });

    const payload = {
      subject: "KYC Submission",
      emailbody: `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New KYC Submission</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: #f8f8f8;
                  margin: 0;
                  padding: 20px;
              }
      
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  padding: 20px;
                  border-radius: 10px;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }
      
              h2 {
                  color: #333333;
                  margin-bottom: 20px;
              }
      
              table {
                  width: 100%;
                  border-collapse: collapse;
              }
      
              th, td {
                  padding: 10px;
                  border-bottom: 1px solid #dddddd;
                  text-align: left;
              }
      
              th {
                  background-color: #f2f2f2;
              }
      
              .button {
                  display: inline-block;
                  background-color: #007bff;
                  color: #ffffff;
                  text-decoration: none;
                  padding: 10px 20px;
                  border-radius: 5px;
              }
      
              .button:hover {
                  background-color: #0056b3;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h2>New KYC Submission</h2>
              <p>Hello Admin,</p>
              <p>A new user has submitted their KYC details. Here are the details:</p>
              <table>
                  <tr>
                      <th>Field</th>
                      <th>Details</th>
                  </tr>
                  <tr>
                      <td>Name</td>
                      <td>${user.firstName}</td>
                  </tr>
                  <tr>
                      <td>Email</td>
                      <td>${user.email}</td>
                  </tr>
                  <tr>
                      <td>Phone</td>
                      <td>${user.phone}</td>
                  </tr>
                  <tr>
                      <td>User Type</td>
                      <td>${user.userType.toUpperCase()}</td>
                  </tr>
                  <!-- Add more fields as needed -->
              </table>
              <p>Please review the details and take necessary actions.</p>
              <a href=${user.document} class="button">View KYC</a>
          </div>
      </body>
      </html>
      `,
      bodyType: "html",
      toEmail: `${"hireinsecond@gmail.com"}`,
    };
    await sendEmail(payload);
    return res.status(200).json({
      success: true,
      message: "Successfully uploaded",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error,
    });
  }
};

const getProfileDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userObj = await User.findById(userId).select("-password").lean();
    if (!userObj) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Populate aliases so frontend components get consistent keys
    if (userObj.title && !userObj.headline) userObj.headline = userObj.title;
    if (userObj.headline && !userObj.title) userObj.title = userObj.headline;
    if (userObj.desiredRole && !userObj.preferredRole) userObj.preferredRole = userObj.desiredRole;
    if (userObj.preferredRole && !userObj.desiredRole) userObj.desiredRole = userObj.preferredRole;
    if (userObj.experienceDetails && !userObj.workExperience) userObj.workExperience = userObj.experienceDetails;
    if (userObj.workExperience && !userObj.experienceDetails) userObj.experienceDetails = userObj.workExperience;
    if (userObj.educationDetails && !userObj.educationHistory) userObj.educationHistory = userObj.educationDetails;
    if (userObj.educationHistory && !userObj.educationDetails) userObj.educationDetails = userObj.educationHistory;
    if (!userObj.fullName && (userObj.firstName || userObj.lastName)) {
      userObj.fullName = [userObj.firstName, userObj.lastName].filter(Boolean).join(" ");
    }

    // Connected accounts, availability & recruiter visibility aliases
    if (userObj.openToOffers === undefined) userObj.openToOffers = true;
    if (userObj.linkedinUrl && !userObj.linkedin) userObj.linkedin = userObj.linkedinUrl;
    if (userObj.linkedin && !userObj.linkedinUrl) userObj.linkedinUrl = userObj.linkedin;
    if (userObj.githubUrl && !userObj.github) userObj.github = userObj.githubUrl;
    if (userObj.github && !userObj.githubUrl) userObj.githubUrl = userObj.github;
    if (userObj.noticePeriod && !userObj.availability) userObj.availability = userObj.noticePeriod;
    if (userObj.availability && !userObj.noticePeriod) userObj.noticePeriod = userObj.availability;

    // Structured connectedAccounts object for consistent mobile/web client consumption
    userObj.connectedAccounts = normalizeConnectedAccounts(userObj.connectedAccounts, userObj);

    res.status(200).json({
      success: true,
      data: sanitizeUserEmail(userObj),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

const getUserStatus = async (req, res) => {
  const id = req.params.id;
  try {
    const users = await User.findOne({ _id: id });
    console.log(users);
    if (!users?.alloted) {
      res.status(200).json({
        success: true,
        message: "Successfully Updated",
      });
    } else {
      res.status(302).json({
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
// Admin panel Apis
const getAdminUsers = async (req, res) => {
  try {
    const allUsers = await User.find();
    res.status(200).json({
      success: true,
      message: "Successfully Updated",
      data: allUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
const getAdminUsersV2 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      subscriptionStatus,
      otpVerified,
      userType,
      kycStatus,
      hasResume,
      hasBenchResources,
      experienceMin,
      experienceMax,
      skills,
      alloted,
      companyStrengthMin,
      companyStrengthMax,
      isProfileCompleted,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // --- Build match stage ---
    const matchStage = {};

    // 1. Search term (across name, email, phone, companyName)
    if (search && search.trim()) {
      const trimmed = search.trim();
      const searchRegex = new RegExp(trimmed, "i");
      const orConditions = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { companyName: searchRegex },
      ];

      // _id is an ObjectId, so we can only match it directly (not via regex)
      if (mongoose.Types.ObjectId.isValid(trimmed) && trimmed.length === 24) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(trimmed) });
      }

      matchStage.$or = orConditions;
    }

    // 2. Status
    if (status !== undefined && status !== "") {
      matchStage.status = status === "true";
    }

    // 3. Subscription Status
    if (subscriptionStatus !== undefined && subscriptionStatus !== "") {
      matchStage.subscriptionStatus = subscriptionStatus === "true";
    }

    // 4. OTP Verified
    if (otpVerified !== undefined && otpVerified !== "") {
      matchStage.otpVerified = otpVerified === "true";
    }

    // 5. User Type (default: client)
    if (userType) {
      matchStage.userType = userType.toLowerCase();
    }

    // 6. KYC Status
    if (kycStatus && kycStatus.trim()) {
      matchStage.kycStatus = kycStatus.toLowerCase();
    }

    // 7. Has Resume
    if (hasResume !== undefined && hasResume !== "") {
      if (hasResume === "true") {
        matchStage.resumeData = { $exists: true, $ne: "" };
      } else {
        matchStage.$and = [
          ...(matchStage.$and || []),
          {
            $or: [
              { resumeData: { $exists: false } },
              { resumeData: "" },
              { resumeData: null },
            ],
          },
        ];
      }
    }

    // 11. Alloted
    if (alloted !== undefined && alloted !== "") {
      matchStage.alloted = alloted === "true";
    }

    // 12. Company Strength range
    if (companyStrengthMin !== undefined || companyStrengthMax !== undefined) {
      const predefinedRanges = [
        "0-20",
        "20-50",
        "50-80",
        "80-150",
        "150-300",
        "300-500",
        "500-800",
        "800-1500",
      ];
      const min = parseInt(companyStrengthMin, 10) || 0;
      const max = parseInt(companyStrengthMax, 10) || Infinity;

      const matchingRanges = predefinedRanges.filter((range) => {
        const [low, high] = range.split("-").map(Number);
        return low >= min && high <= max;
      });

      if (matchingRanges.length > 0) {
        matchStage.strengthOfCompany = { $in: matchingRanges };
      } else {
        // No matching ranges — return empty result
        matchStage.strengthOfCompany = { $in: [] };
      }
    }

    // 13. Is Profile Completed
    if (isProfileCompleted !== undefined && isProfileCompleted !== "") {
      matchStage.isProfileCompleted = isProfileCompleted === "true";
    }

    // --- Build aggregation pipeline ---
    const pipeline = [];

    // Initial match
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // 9. Experience range (cast string to number)
    if (experienceMin !== undefined || experienceMax !== undefined) {
      pipeline.push({
        $addFields: {
          experienceNum: {
            $cond: {
              if: {
                $or: [
                  { $eq: ["$exprience", null] },
                  { $eq: ["$exprience", ""] },
                ],
              },
              then: 0,
              else: { $toInt: "$exprience" },
            },
          },
        },
      });

      const expMatch = {};
      if (experienceMin !== undefined && experienceMin !== "") {
        expMatch.$gte = parseInt(experienceMin, 10);
      }
      if (experienceMax !== undefined && experienceMax !== "") {
        expMatch.$lte = parseInt(experienceMax, 10);
      }
      if (Object.keys(expMatch).length > 0) {
        pipeline.push({ $match: { experienceNum: expMatch } });
      }
    }

    // 10. Skills (comma-separated, match any)
    if (skills && skills.trim()) {
      const skillList = skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (skillList.length > 0) {
        const skillRegexes = skillList.map((s) => new RegExp(s, "i"));
        pipeline.push({
          $match: {
            $or: skillRegexes.map((regex) => ({ skills: regex })),
          },
        });
      }
    }

    // 8. Has Bench Resources ($lookup)
    if (hasBenchResources !== undefined && hasBenchResources !== "") {
      pipeline.push({
        $addFields: {
          userIdStr: { $toString: "$_id" },
        },
      });
      pipeline.push({
        $lookup: {
          from: "employeeonboardings",
          localField: "userIdStr",
          foreignField: "companyId",
          as: "benchResources",
        },
      });
      pipeline.push({
        $addFields: {
          benchResourceCount: { $size: "$benchResources" },
        },
      });

      if (hasBenchResources === "true") {
        pipeline.push({ $match: { benchResourceCount: { $gt: 0 } } });
      } else {
        pipeline.push({ $match: { benchResourceCount: 0 } });
      }

      // Clean up temp fields
      pipeline.push({
        $project: {
          benchResources: 0,
          userIdStr: 0,
          benchResourceCount: 0,
        },
      });
    }

    // Remove temp fields if experience was added
    if (experienceMin !== undefined || experienceMax !== undefined) {
      pipeline.push({
        $project: { experienceNum: 0 },
      });
    }

    // Exclude password from results
    pipeline.push({
      $project: { password: 0 },
    });

    // Facet for pagination
    pipeline.push({
      $facet: {
        metadata: [{ $count: "totalCount" }],
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limitNum },
        ],
      },
    });

    const result = await User.aggregate(pipeline);

    const total = result[0]?.metadata[0]?.totalCount || 0;
    const users = result[0]?.data || [];
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    console.log("getAdminUsersV2 error ==>>", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateUserFields = async (req, res) => {
  try {
    const document = req.body.document || req.body;
    if (!document || typeof document !== "object") {
      return res.status(400).json({
        success: false,
        message: "Update document payload is required.",
      });
    }

    const { email, googleId, ...updateData } = document;

    // Remove immutable fields if they exist in the update payload
    delete updateData._id;

    // Identify user: ALWAYS prioritize authenticated session user ID to prevent account crossover
    const userId = req.user?._id || req.user?.id;
    const userGoogleId = googleId || (!userId ? req.user?.googleId : undefined);
    const userEmail = email ? email.trim().toLowerCase() : (!userId ? req.user?.email : undefined);

    if (!userId && !userEmail && !userGoogleId) {
      return res.status(400).json({
        success: false,
        message: "User identifier (auth token, email, or googleId) is required.",
      });
    }

    // Hash password if it is being updated
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    const filter = {};
    if (userId) filter._id = userId;
    else if (userGoogleId) filter.googleId = userGoogleId;
    else if (userEmail) filter.email = userEmail;

    const existingUser = await User.findOne(filter);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // If user is authenticated via Google OAuth, lock email to Google email
    const isGoogleAccount = Boolean(
      existingUser.googleId ||
      existingUser.connectedAccounts?.google?.id ||
      existingUser.connectedAccounts?.google?.connected
    );

    // If an explicit email change is requested
    if (email !== undefined) {
      const emailLower = email ? email.trim().toLowerCase() : "";
      if (isGoogleAccount) {
        if (emailLower && emailLower !== (existingUser.email || "").toLowerCase()) {
          return res.status(400).json({
            success: false,
            code: "GOOGLE_EMAIL_LOCKED",
            message: "Email address cannot be modified for accounts authenticated via Google.",
          });
        }
      } else {
        const currentCleanEmail = (existingUser.email || "").toLowerCase().endsWith("@phone.hireinsecond.com")
          ? ""
          : (existingUser.email || "").toLowerCase();

        if (emailLower && emailLower !== currentCleanEmail) {
          const existingWithEmail = await User.findOne({
            email: emailLower,
            _id: { $ne: existingUser._id },
          });
          if (existingWithEmail) {
            return res.status(400).json({
              success: false,
              code: "EMAIL_ALREADY_EXISTS",
              message: "An account with this email address already exists.",
            });
          }
          updateData.email = emailLower;
        } else if (!emailLower && currentCleanEmail) {
          updateData.email = "";
        } else if (emailLower && (existingUser.email || "").toLowerCase().endsWith("@phone.hireinsecond.com")) {
          updateData.email = emailLower;
        }
      }
    } else if (!isGoogleAccount && (existingUser.email || "").toLowerCase().endsWith("@phone.hireinsecond.com")) {
      // Proactively clear legacy dummy email if user touches profile
      updateData.email = "";
    }

    // Phone number editability and normalization
    if (updateData.phone !== undefined) {
      const cleanPhone = updateData.phone ? String(updateData.phone).trim() : "";
      if (cleanPhone) {
        const parsed = validateAndParseIndianMobile(cleanPhone);
        if (parsed.isValid) {
          updateData.phone = parsed.e164;
          updateData.countryCode = "+91";
        } else {
          updateData.phone = cleanPhone;
        }
      } else {
        updateData.phone = "";
      }
    }

    // Auto-sync field aliases for experiences
    if (updateData.experienceDetails !== undefined) {
      updateData.workExperience = updateData.experienceDetails;
      updateData.experienceHistory = updateData.experienceDetails;
    } else if (updateData.workExperience !== undefined) {
      updateData.experienceDetails = updateData.workExperience;
      updateData.experienceHistory = updateData.workExperience;
    }

    // Auto-sync field aliases for education
    if (updateData.educationDetails !== undefined) {
      updateData.educationHistory = updateData.educationDetails;
    } else if (updateData.educationHistory !== undefined) {
      updateData.educationDetails = updateData.educationHistory;
    }

    // Auto-sync field aliases for role / title / headline
    if (updateData.title && !updateData.headline) {
      updateData.headline = updateData.title;
    }
    if (updateData.headline && !updateData.title) {
      updateData.title = updateData.headline;
    }
    if (updateData.title && !updateData.role) {
      updateData.role = updateData.title;
    }
    if (updateData.desiredRole) {
      updateData.preferredRole = updateData.desiredRole;
      if (!updateData.role) updateData.role = updateData.desiredRole;
    }

    // Auto-sync field aliases for workMode
    if (updateData.workMode !== undefined) {
      updateData.preferredWorkMode = updateData.workMode;
      updateData.workModes = updateData.workMode;
    } else if (updateData.preferredWorkMode !== undefined) {
      updateData.workMode = updateData.preferredWorkMode;
      updateData.workModes = updateData.preferredWorkMode;
    }

    // Auto-sync field aliases for locations
    if (updateData.preferredLocations !== undefined) {
      updateData.preferredLocation = updateData.preferredLocations;
    } else if (updateData.preferredLocation !== undefined) {
      updateData.preferredLocations = updateData.preferredLocation;
    }

    // Auto-sync field aliases for linkedin / github / portfolio / connectedAccounts
    if (updateData.connectedAccounts) {
      updateData.connectedAccounts = normalizeConnectedAccounts(updateData.connectedAccounts, existingUser);
      const ca = updateData.connectedAccounts;
      if (ca.linkedin?.url) {
        updateData.linkedinUrl = ca.linkedin.url;
        updateData.linkedin = ca.linkedin.url;
      }
      if (ca.github?.url) {
        updateData.githubUrl = ca.github.url;
        updateData.github = ca.github.url;
      }
      if (ca.portfolio?.url) {
        updateData.portfolioUrl = ca.portfolio.url;
      }
    }

    if (updateData.linkedinUrl !== undefined || updateData.linkedin !== undefined) {
      const val = updateData.linkedinUrl !== undefined ? updateData.linkedinUrl : updateData.linkedin;
      updateData.linkedinUrl = val;
      updateData.linkedin = val;
      if (!updateData.connectedAccounts) {
        updateData.connectedAccounts = normalizeConnectedAccounts(existingUser.connectedAccounts, existingUser);
      }
      updateData.connectedAccounts.linkedin = {
        connected: Boolean(val),
        url: val || "",
        username: val ? val.split("/").filter(Boolean).pop() : "",
        connectedAt: val ? new Date() : undefined,
      };
    }

    if (updateData.githubUrl !== undefined || updateData.github !== undefined) {
      const val = updateData.githubUrl !== undefined ? updateData.githubUrl : updateData.github;
      updateData.githubUrl = val;
      updateData.github = val;
      if (!updateData.connectedAccounts) {
        updateData.connectedAccounts = normalizeConnectedAccounts(existingUser.connectedAccounts, existingUser);
      }
      updateData.connectedAccounts.github = {
        connected: Boolean(val),
        url: val || "",
        username: val ? val.split("/").filter(Boolean).pop() : "",
        connectedAt: val ? new Date() : undefined,
      };
    }

    if (updateData.portfolioUrl !== undefined) {
      const val = updateData.portfolioUrl || "";
      updateData.portfolioUrl = val;
      if (!updateData.connectedAccounts) {
        updateData.connectedAccounts = normalizeConnectedAccounts(existingUser.connectedAccounts, existingUser);
      }
      updateData.connectedAccounts.portfolio = {
        connected: Boolean(val),
        url: val,
        connectedAt: val ? new Date() : undefined,
      };
    }

    if (updateData.noticePeriod && !updateData.availability) {
      updateData.availability = updateData.noticePeriod;
    } else if (updateData.availability && !updateData.noticePeriod) {
      updateData.noticePeriod = updateData.availability;
    }

    if (updateData.openToOffers !== undefined) {
      updateData.openToOffers = Boolean(updateData.openToOffers);
    }

    // Auto-sync salary
    if (updateData.expectedSalary !== undefined) {
      const num = typeof updateData.expectedSalary === "number"
        ? updateData.expectedSalary
        : parseInt(String(updateData.expectedSalary).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(num)) updateData.salary = num;
    }

    // Support both experience (proper spelling) and exprience (schema property)
    if (updateData.experience && !updateData.exprience) {
      updateData.exprience = updateData.experience;
    }
    if (updateData.exprience && !updateData.experience) {
      updateData.experience = updateData.exprience;
    }

    // Auto-sync full name with first and last name
    if (updateData.fullName) {
      const parts = updateData.fullName.trim().split(/\s+/);
      if (!updateData.firstName) updateData.firstName = parts[0] || "";
      if (updateData.lastName === undefined) updateData.lastName = parts.slice(1).join(" ");
    } else if (updateData.firstName && !updateData.fullName) {
      updateData.fullName = [updateData.firstName, updateData.lastName].filter(Boolean).join(" ");
    }

    // Smart merge skills if mergeSkills flag is true or when updating via resume
    if (updateData.skills !== undefined && (updateData.mergeSkills || updateData.resumeData)) {
      const existingSkillList = (existingUser.skills || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const incomingSkillList = (Array.isArray(updateData.skills) ? updateData.skills : String(updateData.skills).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      const mergedList = [
        ...new Map(
          [...existingSkillList, ...incomingSkillList].map((s) => [s.toLowerCase(), s])
        ).values(),
      ];
      updateData.skills = mergedList.join(", ");
    }

    if (updateData.companyName) {
      if (existingUser.companyName !== updateData.companyName) {
        updateData.kycStatus = KYC_STATUS_LIST.PENDING;
        updateData.document = "";
      }
    }

    const effectiveUserType = updateData.userType || existingUser.userType;
    const mergedUser = {
      ...existingUser.toObject(),
      ...updateData,
      email: userEmail || existingUser.email,
      userType: effectiveUserType,
    };

    let isProfileCompleted = existingUser.isProfileCompleted || false;
    if (updateData.isProfileCompleted !== undefined) {
      isProfileCompleted = Boolean(updateData.isProfileCompleted);
    } else {
      switch (effectiveUserType) {
        case USER_TYPES.CLIENT:
        case USER_TYPES.COMPANY:
          if (mergedUser.companyName && (mergedUser.designation || mergedUser.role)) {
            isProfileCompleted = true;
          }
          break;
        case USER_TYPES.PERSONAL:
        case USER_TYPES.INDIVIDUAL:
          if (mergedUser.skills && (mergedUser.exprience || mergedUser.experience || mergedUser.role || mergedUser.title || (mergedUser.experienceDetails && mergedUser.experienceDetails.length > 0))) {
            isProfileCompleted = true;
          }
          break;
        default:
          isProfileCompleted = existingUser.isProfileCompleted || false;
          break;
      }
    }
    updateData.isProfileCompleted = isProfileCompleted;

    const user = await User.findOneAndUpdate(filter, { $set: updateData }, {
      new: true, // Return the updated document
      runValidators: false,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const returnData = user.toObject ? user.toObject() : { ...user };
    if (returnData.openToOffers === undefined) returnData.openToOffers = true;
    if (returnData.linkedinUrl && !returnData.linkedin) returnData.linkedin = returnData.linkedinUrl;
    if (returnData.linkedin && !returnData.linkedinUrl) returnData.linkedinUrl = returnData.linkedin;
    if (returnData.githubUrl && !returnData.github) returnData.github = returnData.githubUrl;
    if (returnData.github && !returnData.githubUrl) returnData.githubUrl = returnData.github;
    if (returnData.noticePeriod && !returnData.availability) returnData.availability = returnData.noticePeriod;
    if (returnData.availability && !returnData.noticePeriod) returnData.noticePeriod = returnData.availability;
    returnData.connectedAccounts = normalizeConnectedAccounts(returnData.connectedAccounts, returnData);

    res.status(200).json({
      success: true,
      message: "User details updated successfully",
      data: sanitizeUserEmail(returnData),
    });
  } catch (error) {
    console.error("Error updating user fields:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


const updateKYCFromAdmin = async (req, res) => {
  try {
    const { newStatus, id } = req.body;
    const users = await User.findOne({ _id: id });
    console.log(users);
    if (users) {
      users.kycStatus = newStatus;
      await users.save();
      res.status(200).json({
        success: true,
        message: "Successfully Updated",
        data: users,
      });
    } else {
      res.status(403).json({
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const deactivateUser = async (req, res) => {
  try {
    const { newStatus, id } = req.body;
    const users = await User.findOne({ _id: id });
    console.log(users);
    if (users) {
      users.status = newStatus;
      await users.save();
      res.status(200).json({
        success: true,
        message: "Successfully Updated",
        data: users,
      });
    } else {
      res.status(403).json({
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { password, id } = req.body;
    const users = await User.findOne({ _id: id });
    console.log(users);
    if (users) {
      users.password = password;
      await users.save();
      res.status(200).json({
        success: true,
        message: "Successfully Updated",
      });
    } else {
      res.status(403).json({
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
const updateResume = async (req, res) => {
  try {
    const { resumeData, id, document } = req.body;
    const users = await User.findOne({ _id: id });
    console.log(users);
    if (users) {
      users.resumeData = resumeData;
      users.document = document;
      await users.save();
      res.status(200).json({
        success: true,
        message: "Successfully Updated",
      });
    } else {
      res.status(403).json({
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const parseResume = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "A PDF resume is required." });
  }
  if (activeResumeParses >= 50) {
    await fs.unlink(req.file.path).catch(() => undefined);
    return res.status(429).json({ success: false, message: "Resume parser is busy. Please try again shortly." });
  }

  activeResumeParses += 1;
  try {
    const parsed = await parsePdfResume(req.file.path);

    // RES-01: Auto-enrich candidate profile if authenticated
    try {
      const userId = req.user?._id || req.user?.id || req.decodedUser?.id || req.body?.userId;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const userDoc = await Users.findById(userId);
        if (userDoc) {
          // If parsed data lacks certain fields, enrich parsed object with existing profile fields
          if (!parsed.fullName && (userDoc.fullName || userDoc.firstName)) {
            parsed.fullName = userDoc.fullName || [userDoc.firstName, userDoc.lastName].filter(Boolean).join(" ");
          }
          if (!parsed.phone && userDoc.phone) {
            parsed.phone = userDoc.phone;
          }
          if (!parsed.location && (userDoc.location || userDoc.city)) {
            parsed.location = userDoc.location || userDoc.city;
          }
          if (!parsed.headline && (userDoc.headline || userDoc.title)) {
            parsed.headline = userDoc.headline || userDoc.title;
          }
          if (!parsed.bio && userDoc.bio) {
            parsed.bio = userDoc.bio;
          }
          if ((!parsed.skills || parsed.skills.length === 0) && userDoc.skills) {
            parsed.skills = typeof userDoc.skills === "string"
              ? userDoc.skills.split(",").map((s) => s.trim()).filter(Boolean)
              : Array.isArray(userDoc.skills) ? userDoc.skills : [];
          }
          if ((!parsed.experience || parsed.experience.length === 0) && Array.isArray(userDoc.experienceDetails) && userDoc.experienceDetails.length > 0) {
            parsed.experience = userDoc.experienceDetails;
          }
          if ((!parsed.education || parsed.education.length === 0) && Array.isArray(userDoc.educationDetails) && userDoc.educationDetails.length > 0) {
            parsed.education = userDoc.educationDetails;
          }
          if (!parsed.linkedinUrl && (userDoc.linkedinUrl || userDoc.linkedin)) {
            parsed.linkedinUrl = userDoc.linkedinUrl || userDoc.linkedin;
          }
          if (!parsed.githubUrl && (userDoc.githubUrl || userDoc.github)) {
            parsed.githubUrl = userDoc.githubUrl || userDoc.github;
          }
          if (!parsed.portfolioUrl && userDoc.portfolioUrl) {
            parsed.portfolioUrl = userDoc.portfolioUrl;
          }

          // If parsed data has updated fields from the newly uploaded resume, override and update userDoc
          if (parsed.headline) {
            userDoc.headline = parsed.headline;
            if (!userDoc.title) userDoc.title = parsed.headline;
          }
          if (parsed.bio) {
            userDoc.bio = parsed.bio;
          }
          if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
            const existing = (
              typeof userDoc.skills === "string"
                ? userDoc.skills.split(",")
                : Array.isArray(userDoc.skills)
                ? userDoc.skills
                : []
            )
              .map((s) => s.trim())
              .filter(Boolean);
            const merged = Array.from(new Set([...existing, ...parsed.skills]));
            userDoc.skills = merged.join(", ");
          }
          if (Array.isArray(parsed.experience) && parsed.experience.length > 0) {
            userDoc.experienceDetails = parsed.experience;
            userDoc.workExperience = parsed.experience;
            userDoc.experienceHistory = parsed.experience;
          }
          if (Array.isArray(parsed.education) && parsed.education.length > 0) {
            userDoc.educationDetails = parsed.education;
            userDoc.educationHistory = parsed.education;
          }
          if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
            userDoc.projects = parsed.projects;
          }
          if (Array.isArray(parsed.certifications) && parsed.certifications.length > 0) {
            userDoc.certifications = parsed.certifications;
          }
          if (parsed.linkedinUrl) {
            userDoc.linkedinUrl = parsed.linkedinUrl;
            userDoc.linkedin = parsed.linkedinUrl;
          }
          if (parsed.githubUrl) {
            userDoc.githubUrl = parsed.githubUrl;
            userDoc.github = parsed.githubUrl;
          }
          if (parsed.portfolioUrl) {
            userDoc.portfolioUrl = parsed.portfolioUrl;
          }
          if (parsed.fullName) {
            userDoc.fullName = parsed.fullName;
            const [first, ...rest] = parsed.fullName.split(" ");
            if (first) userDoc.firstName = first;
            if (rest.length > 0) userDoc.lastName = rest.join(" ");
          }
          if (parsed.phone) {
            userDoc.phone = parsed.phone;
          }
          if (parsed.location) {
            userDoc.location = parsed.location;
          }
          userDoc.parsedResume = parsed;
          await userDoc.save();
        }
      }
    } catch (enrichError) {
      console.warn("Could not auto-enrich user doc during resume parse:", enrichError.message);
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (error) {
    console.error("Resume parsing failed:", error.message);
    return res.status(422).json({
      success: false,
      message: error.message || "Could not read this PDF resume.",
    });
  } finally {
    activeResumeParses -= 1;
    await fs.unlink(req.file.path).catch(() => undefined);
  }
};

const getStandardizedResume = async (req, res) => {
  const id = req.params.id || req.query.id;
  if (!id) {
    return res.status(400).json({ success: false, message: "Candidate ID is required" });
  }

  try {
    let candidate = null;

    // 1. Try finding in Users collection
    if (mongoose.Types.ObjectId.isValid(id)) {
      candidate = await Users.findById(id).lean();
    }

    // 2. Try finding in EmployeeOnboarding (Bench specialist)
    if (!candidate && mongoose.Types.ObjectId.isValid(id)) {
      const employee = await EmployeeOnboarding.findById(id).lean();
      if (employee) {
        let vendorCompany = null;
        if (employee.companyId && mongoose.Types.ObjectId.isValid(employee.companyId)) {
          vendorCompany = await Users.findById(employee.companyId).lean();
        }
        candidate = {
          _id: employee._id,
          fullName: employee.name || "Bench Specialist",
          headline: employee.designation || "Senior Systems Engineer",
          email: employee.email || vendorCompany?.email || "candidate@hireinsecond.com",
          phone: employee.phone || vendorCompany?.phone || "+91 98450 00000",
          location: employee.location || vendorCompany?.location || "India",
          bio: employee.bio || `${employee.name || "Candidate"} is a verified technical specialist with ${employee.exprience || "5+ years"} of industry experience.`,
          skills: employee.skills,
          experienceDetails: employee.experienceDetails || [],
          educationDetails: employee.educationDetails || [],
          isVerified: true,
        };
      }
    }

    // 3. Try finding in JobsApplication
    if (!candidate && mongoose.Types.ObjectId.isValid(id)) {
      const app = await JobsApplication.findById(id).lean();
      if (app) {
        const candidateId = app.companyId || app.employeeId;
        if (candidateId && candidateId.toString() !== id) {
          req.params.id = candidateId.toString();
          return getStandardizedResume(req, res);
        }
      }
    }

    if (!candidate) {
      if (req.query.format === "json") {
        return res.status(404).json({ success: false, message: "Candidate profile not found" });
      }
      return res.status(404).send("<html><body><h2>Candidate profile not found</h2></body></html>");
    }

    const name =
      candidate.fullName ||
      [candidate.firstName, candidate.lastName].filter(Boolean).join(" ").trim() ||
      candidate.name ||
      "Candidate";

    const title =
      candidate.headline ||
      candidate.title ||
      candidate.desiredRole ||
      candidate.role ||
      candidate.designation ||
      "Software Engineer";

    const skills = cleanSkills(candidate.skills || candidate.parsedResume?.skills || []);
    const experiences = sanitizeExperiences(
      candidate.experienceDetails || candidate.workExperience || candidate.experienceHistory,
      candidate.parsedResume?.experience
    );
    const education = sanitizeEducation(
      candidate.educationDetails || candidate.educationHistory,
      candidate.parsedResume?.education
    );

    const email = candidate.email || "";
    const phone = candidate.phone || "";
    const maskedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, "$1••••••$3") : "••••••@talent.in";
    const maskedPhone = phone ? phone.replace(/(\+?\d{2,4})\d{4,6}(\d{2})/, "$1 •••••• $2") : "+91 ••••• •••••";

    const isVerified = Boolean(candidate.isProfileCompleted || candidate.isVerified || candidate.kycStatus === "approved");

    const requesterId = req.user?._id?.toString() || req.user?.id?.toString();
    const isCandidateSelf = Boolean(requesterId && requesterId === candidate._id.toString());

    const resumeData = {
      id: candidate._id.toString(),
      name,
      title,
      location: candidate.location || "India",
      email,
      phone,
      maskedEmail,
      maskedPhone,
      bio: candidate.bio || "",
      skills: skills.length > 0 ? skills : ["Software Development", "System Design", "Problem Solving"],
      experiences,
      education,
      isVerified,
      isCandidateSelf,
    };

    if (req.query.format === "json") {
      return res.status(200).json({ success: true, data: resumeData });
    }

    const html = generateStandardizedResumeHtml(resumeData);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    console.error("Error in getStandardizedResume:", error);
    if (req.query.format === "json") {
      return res.status(500).json({ success: false, message: error.message });
    }
    return res.status(500).send("<html><body><h2>Error generating standardized resume</h2></body></html>");
  }
};

const updateConnectedAccounts = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { service, url, username, connectedAccounts } = req.body;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentConn = normalizeConnectedAccounts(user.connectedAccounts, user);
    const updateObj = {};

    if (connectedAccounts) {
      Object.keys(connectedAccounts).forEach((svc) => {
        const val = connectedAccounts[svc];
        const cleanSvc = svc.toLowerCase();
        const cleanUrl = typeof val === "string" ? val.trim() : (val?.url || "").trim();
        const cleanUser = typeof val === "object" && val?.username ? val.username : (cleanUrl ? cleanUrl.split("/").filter(Boolean).pop() : "");

        currentConn[cleanSvc] = {
          connected: Boolean(cleanUrl),
          url: cleanUrl,
          username: cleanUser,
          connectedAt: cleanUrl ? new Date() : undefined,
        };

        if (cleanSvc === "linkedin") {
          updateObj.linkedinUrl = cleanUrl;
          updateObj.linkedin = cleanUrl;
        } else if (cleanSvc === "github") {
          updateObj.githubUrl = cleanUrl;
          updateObj.github = cleanUrl;
        } else if (cleanSvc === "portfolio") {
          updateObj.portfolioUrl = cleanUrl;
        }
      });
    } else if (service) {
      const cleanService = service.toLowerCase();
      const cleanUrl = (url || "").trim();
      const cleanUser = username || (cleanUrl ? cleanUrl.split("/").filter(Boolean).pop() : "");

      currentConn[cleanService] = {
        connected: Boolean(cleanUrl),
        url: cleanUrl,
        username: cleanUser,
        connectedAt: cleanUrl ? new Date() : undefined,
      };

      if (cleanService === "linkedin") {
        updateObj.linkedinUrl = cleanUrl;
        updateObj.linkedin = cleanUrl;
      } else if (cleanService === "github") {
        updateObj.githubUrl = cleanUrl;
        updateObj.github = cleanUrl;
      } else if (cleanService === "portfolio") {
        updateObj.portfolioUrl = cleanUrl;
      }
    }

    updateObj.connectedAccounts = currentConn;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateObj },
      { new: true, runValidators: false }
    );

    return res.status(200).json({
      success: true,
      message: "Connected accounts updated successfully",
      data: updatedUser?.connectedAccounts || currentConn,
    });
  } catch (error) {
    console.error("updateConnectedAccounts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update connected accounts",
      error: error.message,
    });
  }
};

const disconnectAccount = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { service } = req.body;
    if (!service) {
      return res.status(400).json({ success: false, message: "Service name is required" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentConn = normalizeConnectedAccounts(user.connectedAccounts, user);
    const cleanService = service.toLowerCase();

    currentConn[cleanService] = {
      connected: false,
      url: "",
      username: "",
    };

    const updateObj = {
      connectedAccounts: currentConn,
    };

    if (cleanService === "linkedin") {
      updateObj.linkedinUrl = "";
      updateObj.linkedin = "";
    } else if (cleanService === "github") {
      updateObj.githubUrl = "";
      updateObj.github = "";
    } else if (cleanService === "portfolio") {
      updateObj.portfolioUrl = "";
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateObj },
      { new: true, runValidators: false }
    );

    return res.status(200).json({
      success: true,
      message: `${service} disconnected successfully`,
      data: updatedUser?.connectedAccounts || currentConn,
    });
  } catch (error) {
    console.error("disconnectAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to disconnect account",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in again.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const hasExistingPassword = Boolean(user.password && user.password.trim());

    if (hasExistingPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Please enter your current password.",
        });
      }
      const isMatch = bcrypt.compareSync(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password does not match our records.",
        });
      }
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must contain at least 6 characters.",
      });
    }

    if (hasExistingPassword && currentPassword === newPassword.trim()) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password.",
      });
    }

    user.password = newPassword.trim();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update password.",
    });
  }
};

module.exports = {
  register,
  registerMobile,
  login,
  generateOtp,
  verifyOtp,
  updateProfile,
  getProfileDetails,
  getAdminUsers,
  getUserStatus,
  deactivateUser,
  updateKYCFromAdmin,
  editProfile,
  resetPassword,
  updateResume,
  loginWithMobile,
  walletConnect,
  getUserDetails,
  patchDetails,
  updateUserFields,
  getAdminUsersV2,
  updateConnectedAccounts,
  disconnectAccount,
  changePassword,
  parseResume,
  getStandardizedResume,
};
