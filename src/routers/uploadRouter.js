const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const multer = require("multer");
// const { multerMiddleware } = require("../middlewares/multerMiddleware");
const { uploadFile } = require("../controllers/uploadController");
const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Define a route to handle file uploads
router.post("/", userAuthorization, upload.single("file"), uploadFile);

module.exports = router;
