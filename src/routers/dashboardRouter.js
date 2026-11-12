const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const { getDashboardLists } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/getDashboardLists/:id", userAuthorization, getDashboardLists);

module.exports = router;
