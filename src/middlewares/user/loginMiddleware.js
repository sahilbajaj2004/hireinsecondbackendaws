const bcrypt = require("bcryptjs");
const User = require("../../models/userModel");
const { checkRoleConflict } = require("../../helpers/roleHelper");

const loginMiddleware = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail) {
      return res.status(400).send({
        success: false,
        message: "Email is required.",
        error: "Email is required.",
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).send({
        success: false,
        message: "Password is required.",
        error: "Password is required.",
      });
    }

    const cleanEmail = trimmedEmail.toLowerCase();
    const userObj = await User.findOne({
      $or: [{ email: cleanEmail }, { email: trimmedEmail }],
    });

    if (!userObj) {
      return res.status(404).send({
        success: false,
        userNotFound: true,
        message: "No account found with this email. Please sign up to create an account.",
        error: "No account found with this email. Please sign up to create an account.",
      });
    }

    if (req.body.userType) {
      const conflict = checkRoleConflict(userObj.userType, req.body.userType);
      if (conflict) {
        return res.status(400).send({
          success: false,
          code: "ROLE_CONFLICT",
          message: conflict,
          error: conflict,
        });
      }
    }

    // Handle users registered via Google or without password
    if (!userObj.password || typeof userObj.password !== "string") {
      if (userObj.googleId) {
        return res.status(400).send({
          success: false,
          message: "This account was registered with Google. Please sign in with Google.",
          error: "This account was registered with Google. Please sign in with Google.",
        });
      }
      return res.status(401).send({
        success: false,
        message: "No password is set for this account. Please sign in with Google or reset your password.",
        error: "No password is set for this account. Please sign in with Google or reset your password.",
      });
    }

    if (!bcrypt.compareSync(password, userObj.password)) {
      return res.status(401).send({
        success: false,
        message: "Invalid password. Please try again.",
        error: "Invalid password. Please try again.",
      });
    }

    if (!userObj.otpVerified) {
      return res.status(302).send({
        id: userObj?._id,
        success: false,
        message: "Please verify your email",
        error: "Please verify your email",
      });
    }

    if (!userObj.status) {
      return res.status(401).send({
        success: false,
        message: "Your account is deactivated, please contact support team",
        error: "Your account is deactivated, please contact support team",
      });
    }

    req.userId = userObj._id || userObj.id;
    next();
  } catch (error) {
    console.error("loginMiddleware error:", error);
    return res.status(500).send({
      success: false,
      message: error?.message || "Internal server error during login",
      error: error?.message || "Internal server error",
    });
  }
};

module.exports = loginMiddleware;
