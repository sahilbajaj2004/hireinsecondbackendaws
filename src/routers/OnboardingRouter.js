const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const { acceptOnboarding } = require("../controllers/OnboardingController");

const router = express.Router();

router.post("/acceptOnboarding", userAuthorization, acceptOnboarding);

module.exports = router;
