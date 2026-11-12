const express = require("express");
const { getLocalization } = require("../controllers/languageController");

const router = express.Router();

router.get("/getLocalization", getLocalization);

module.exports = router;
