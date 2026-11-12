const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const {
  addInterview,
  getInterviewList,
  getInterviewById,
  resheduleInterview,
  deleteInterview,
  resheduleMsg,
  getRescheduleMessage,
  acceptInterview,
  acceptReSchedulingRequest,
  addInterviewFeedback,
  inviteBenchResource,
  checkInterviewStatus,
  getEmployeeInterviewLists,
  getEmployeeInterviewListsForClient,
} = require("../controllers/meetController");

const router = express.Router();

router.post("/addInterview", userAuthorization, addInterview);
router.get("/getInterviewList", userAuthorization, getInterviewList);
router.get("/getInterviewById/:id", userAuthorization, getInterviewById);
// The frontend calls `GET /api/getInterviewById?id=<id>` (query param) via
// app/api/getInterviewById/route.ts. Register the query-param variant too.
router.get("/getInterviewById", userAuthorization, getInterviewById);
router.post("/resheduleInterview", userAuthorization, resheduleInterview);
router.post("/deleteInterview", userAuthorization, deleteInterview);
router.post("/resheduleMsg", userAuthorization, resheduleMsg);
router.get("/getRescheduleMessage/:id", userAuthorization, getRescheduleMessage);
router.post("/acceptInterview", userAuthorization, acceptInterview);
router.post("/acceptReSchedulingRequest", userAuthorization, acceptReSchedulingRequest);
router.post("/addInterviewFeedback", userAuthorization, addInterviewFeedback);
router.post("/inviteBenchResource", userAuthorization, inviteBenchResource);
router.get("/checkInterviewStatus/:id", userAuthorization, checkInterviewStatus);
router.get("/getEmployeeInterviewLists", userAuthorization, getEmployeeInterviewLists);
router.get(
  "/getEmployeeInterviewListsForClient",
  userAuthorization,
  getEmployeeInterviewListsForClient
);

module.exports = router;
