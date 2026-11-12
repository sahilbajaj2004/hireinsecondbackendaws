const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const {
  addJobs,
  getJobs,
  updateJobs,
  getAdminJobs,
  deactivateJob,
  upsertSavedJob,
  getSavedJobsByUserId,
  getjobDetailsById,
  getSavedJobs,
} = require("../controllers/jobsController");

const router = express.Router();

router.post("/addJobs", userAuthorization, addJobs);
router.get("/getJobs", getJobs);
router.get("/getJobs/", getJobs);
router.post("/updateJobs", userAuthorization, updateJobs);
router.post("/deactivateJob", userAuthorization, deactivateJob);
router.get("/getAdminJobs", userAuthorization, getAdminJobs);
router.post("/upsertSavedJob", userAuthorization, upsertSavedJob);
router.get("/getSavedJobsByUserId/:id", userAuthorization, getSavedJobsByUserId);
router.get("/getSavedJobs", userAuthorization, getSavedJobs);
router.get("/getjobDetailsById", getjobDetailsById);
router.get("/getjobDetailsById/:id", getjobDetailsById);
// The frontend (hireinsecond) calls the job-detail endpoint with camelCase:
// `/api/getJobDetailsById/:id` (see app/api/getJobById/route.ts + page loaders).
// Express matches route paths case-sensitively, so keep both spellings working.
router.get("/getJobDetailsById", getjobDetailsById);
router.get("/getJobDetailsById/:id", getjobDetailsById);

module.exports = router;
