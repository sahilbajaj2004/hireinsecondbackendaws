const express = require("express");
const multer = require("multer");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  register,
  registerMobile,
  login,
  generateOtp,
  verifyOtp,
  updateProfile,
  getProfileDetails,
  getAdminUsers,
  getUserStatus,
  updateKYCFromAdmin,
  deactivateUser,
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
} = require("../controllers/userController");
const loginMiddleware = require("../middlewares/user/loginMiddleware");
const jwtMiddleware = require("../middlewares/user/jwtMiddleware");
// const userAuthorization = require("../middlewares/user/jwtMiddleware");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const router = express.Router();

const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, callback) => callback(null, `${Date.now()}-${randomUUID()}.pdf`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isPdf =
      file.mimetype === "application/pdf" ||
      ext === ".pdf" ||
      file.mimetype === "application/octet-stream";
    callback(isPdf ? null : new Error("Only PDF resumes are supported."), isPdf);
  },
});

const uploadResume = (req, res, next) => {
  resumeUpload.fields([
    { name: "file", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      req.file = req.files?.file?.[0] || req.files?.resume?.[0];
      return next();
    }
    const message = error.code === "LIMIT_FILE_SIZE" ? "PDF must be 5 MB or smaller." : error.message;
    return res.status(400).json({ success: false, message });
  });
};

router.post("/register", register);
router.post("/registerMobile", registerMobile);
router.post("/login", loginMiddleware, login);
router.post("/otp/generate", generateOtp);
router.post("/otp/verify", verifyOtp);
// router.post("/update", jwtMiddleware, updateProfile);
// router.get("/profile", jwtMiddleware, getProfileDetails);
router.post("/update", userAuthorization, updateProfile);
router.get("/profile", userAuthorization, getProfileDetails);
router.get("/getAdminUsers", userAuthorization, getAdminUsers);
router.get("/getAdminUsersV2", userAuthorization, getAdminUsersV2);
router.get("/getUserStatus/:id", userAuthorization, getUserStatus);
router.post("/updateKYCFromAdmin", userAuthorization, updateKYCFromAdmin);
router.post("/deactivateUser", userAuthorization, deactivateUser);
router.post("/editProfile", userAuthorization, editProfile);
router.post("/resetPassword", resetPassword);
router.post("/updateResume", userAuthorization, updateResume);
router.post("/loginWithMobile", loginWithMobile);
router.post("/walletConnect", userAuthorization, walletConnect);
router.post("/patchDetails", userAuthorization, patchDetails);
router.post("/updateUserFields", userAuthorization, updateUserFields);
router.post("/connectedAccounts", userAuthorization, updateConnectedAccounts);
router.post("/disconnectAccount", userAuthorization, disconnectAccount);
router.post("/changePassword", userAuthorization, changePassword);
router.post("/parseResume", userAuthorization, uploadResume, parseResume);
router.get("/standardizedResume/:id", getStandardizedResume);
module.exports = router;
