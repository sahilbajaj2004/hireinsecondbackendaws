const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const {
  getUsersDataForAdmin,
  getJobApplicationsAdmin,
  getJobApplicationForAdminUserWise,
  registerClient,
  getJobApplicationsForAdmin,
} = require("../controllers/adminControllers");
const { getJobDataForAdmin } = require("../controllers/adminControllers");
const {
  getBlogs,
  addBlogs,
  getBlogsById,
  updateBlogs,
  deleteBlogs,
} = require("../controllers/blogsController");

const router = express.Router();

router.get(
  "/getUsersDataForAdmin/:period/:year?/:month?",
  userAuthorization,
  getUsersDataForAdmin
);
router.get("/getJobDataForAdmin/:period/:year?/:month?", userAuthorization, getJobDataForAdmin);
router.get(
  "/getJobApplicationsAdmin/:period/:year?/:month?",
  userAuthorization,
  getJobApplicationsAdmin
);
router.get(
  "/getJobApplicationForAdminUserWise/:type",
  userAuthorization,
  getJobApplicationForAdminUserWise
);
router.get("/getBlogs", getBlogs);
router.post("/addBlogs", userAuthorization, addBlogs);
router.post("/updateBlogs", userAuthorization, updateBlogs);
router.post("/deleteBlogs", userAuthorization, deleteBlogs);
router.get("/getBlogsById/:id", getBlogsById);
router.get("/getJobApplicationsForAdmin", userAuthorization, getJobApplicationsForAdmin);

router.post("/registerClient", userAuthorization, registerClient);
module.exports = router;
