const express = require("express");
const {
  addJobsApplications,
  getJobsApplications,
  updateApplicatonJobs,
  getJobApplicationById,
  getOnboaredApplication,
  updateAplicationOfJob,
  getEmployeeListByJobId,
  getEmployeeListByJobIdForClient,
  getJobsApplicationsV2,
} = require("../controllers/jobsApplicationsController");
const {
  getJobSeekerAndVendor,
  inviteJobInvitation,
  getInvitations,
  respondJobInvitation,
  getCandidateProfile,
} = require("../controllers/invitationController");
const {
  addAggrement,
  getAggrement,
} = require("../controllers/AggrementController");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const router = express.Router();

router.post("/addJobsApplication", userAuthorization, addJobsApplications);
router.get("/getJobApplications", userAuthorization, getJobsApplications);
router.post("/updateApplicatonJobs", userAuthorization, updateApplicatonJobs);
router.get("/getJobApplicationById/:id", userAuthorization, getJobApplicationById);
router.get("/getJobSeekerAndVendor", userAuthorization, getJobSeekerAndVendor);
router.post("/inviteJobInvitation", userAuthorization, inviteJobInvitation);
router.get("/getInvitations", userAuthorization, getInvitations);
router.post("/respondJobInvitation", userAuthorization, respondJobInvitation);
router.get("/getCandidateProfile/:id", userAuthorization, getCandidateProfile);
router.get("/getCandidateProfile", userAuthorization, getCandidateProfile);
router.get("/getOnboaredApplication", userAuthorization, getOnboaredApplication);
router.get("/getAggrement", userAuthorization, getAggrement);
router.post("/addAggrement", userAuthorization, addAggrement);
router.post("/updateAplicationOfJob", userAuthorization, updateAplicationOfJob);
router.get("/getEmployeeListByJobId", userAuthorization, getEmployeeListByJobId);
router.get("/getEmployeeListByJobIdForClient", userAuthorization, getEmployeeListByJobIdForClient);
router.get("/getJobApplicationsV2", userAuthorization, getJobsApplicationsV2);


module.exports = router;
