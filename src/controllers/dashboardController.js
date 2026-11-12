const { USER_TYPES } = require("../constants/constants");
const EmployeeOnboarding = require("../models/employeeModel");
const JobsInvitations = require("../models/invitationModel");
const JobsApplications = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const JobsInterview = require("../models/mettingModel");
const SavedJobs = require("../models/savedJobs");
const Users = require("../models/userModel");

const getDashboardLists = async (req, res) => {
  const companyId = req.params.id;
  const type = req.query.type;

  console.log(companyId);
  let dashboardData = [];

  if (type && type === "admin") {
    try {
      const jobs = await Jobs.find();
      dashboardData.push({
        name: "Jobs",
        desc: "Checkout the total jobs",
        count: jobs.length,
        bgColor: "primary",
      });
      const users = await Users.find();
      dashboardData.push({
        name: "Users",
        count: users.length,
        desc: "Checkout the total users",
        bgColor: "success",
      });

      const vendorList = users.filter(
        (i) =>
          i.userType === USER_TYPES.COMPANY ||
          i.userType === USER_TYPES.INDIVIDUAL
      );
      dashboardData.push({
        name: "Vendors",
        count: vendorList.length,
        bgColor: "danger",
        desc: "Checkout the total vendors",
      });

      const clientList = users.filter((i) => i.userType === USER_TYPES.CLIENT);
      dashboardData.push({
        name: "Clients",
        count: clientList.length,
        bgColor: "warning",
        desc: "Checkout the total clients",
      });

      const jobSeeker = users.filter((i) => i.userType === USER_TYPES.PERSONAL);
      dashboardData.push({
        name: "Job Seekers",
        count: jobSeeker.length,
        bgColor: "info",
        desc: "Checkout the total job seekers",
      });
      const jobApp = await JobsApplications.find();
      dashboardData.push({
        name: "Job Applications",
        count: jobApp.length,
        bgColor: "secondary",
        desc: "Checkout the total jobApplications",
      });

      res.status(200).json({
        success: true,
        message: "Successfully fetched data",
        data: dashboardData,
      });
    } catch (error) {
      res.status(500).json({ success: false, error });
    }
  } else {
    try {
      if (!companyId || companyId === "") {
        res.status(400).json({
          success: false,
          message: "Bad Request",
        });
      } else {
        const allJobsLists = await Jobs.find({ companyId: companyId });
        const employeeList = await EmployeeOnboarding.find({
          companyId: companyId,
        });
        const allSavedJobList = await SavedJobs.find({
          userId: companyId,
          isSaved: true,
        });
        const allInviteLists = await JobsInvitations.find({
          companyId: companyId,
        });
        const users = await Users.findOne({ _id: companyId });
        const filter =
          users?.userType === "client"
            ? { clientId: companyId }
            : { companyId: companyId };

        const applicationLists = await JobsApplications.find(filter);
        const onboardedLists = await JobsApplications.find({
          status: "ONBOARDED",
          ...filter,
        });
        let queryInterview =
          users?.userType === "client"
            ? { clientId: companyId }
            : { employeeId: companyId };
        const jobInterview = await JobsInterview.find(queryInterview);
        switch (users?.userType) {
          case USER_TYPES.COMPANY:
            dashboardData.push(
              {
                label: "Applied",
                bg: "blue",
                link: "/applied",
                count: applicationLists.length,
              },
              {
                label: "All Users",
                bg: "purple",
                link: "/users",
                count: employeeList?.length,
              },
              {
                label: "Invite",
                bg: "orange",
                link: "/invite",
                count: allInviteLists.length,
              },
              {
                label: "Saved Jobs",
                bg: "green",
                link: "/saved-jobs",
                count: allSavedJobList.length,
              },
              {
                label: "Interviews",
                bg: "slate",
                link: "/interviews-lists",
                count: jobInterview.length,
              },
              {
                label: "Onboarded Candidates",
                bg: "pink",
                link: "/onboarded-lists",
                count: onboardedLists.length,
              }
            );

            break;
          case USER_TYPES.INDIVIDUAL:
            dashboardData.push(
              {
                label: "Applied",
                bg: "blue",
                link: "/applied",
                count: applicationLists.length,
              },
              {
                label: "All Users",
                bg: "purple",
                link: "/users",
                count: employeeList?.length,
              },
              {
                label: "Invite",
                bg: "orange",
                link: "/invite",
                count: allInviteLists.length,
              },
              {
                label: "Saved Jobs",
                bg: "green",
                link: "/saved-jobs",
                count: allSavedJobList.length,
              },
              {
                label: "Interviews",
                bg: "slate",
                link: "/interviews-lists",
                count: jobInterview.length,
              },
              {
                label: "Onboarded Candidates",
                bg: "pink",
                link: "/onboarded-lists",
                count: onboardedLists.length,
              }
            );
            break;
          case USER_TYPES.CLIENT:
            dashboardData.push(
              {
                label: "Applications",
                bg: "blue",
                link: "/applied",
                count: applicationLists.length,
              },
              {
                label: "Active Jobs",
                bg: "green",
                link: "/active-job",
                count: allJobsLists?.length,
              },
              {
                label: "Invite",
                bg: "orange",
                link: "/invite",
                count: allInviteLists.length,
              },
              {
                label: "Interviews",
                bg: "slate",
                link: "/interviews-lists",
                count: jobInterview.length,
              },
              {
                label: "Onboarded Candidates",
                bg: "pink",
                link: "/onboarded-lists",
                count: onboardedLists.length,
              }
            );
            break;
          case USER_TYPES.PERSONAL:
            dashboardData.push(
              {
                label: "Applied",
                bg: "blue",
                link: "/applied",
                count: applicationLists.length,
              },
              {
                label: "Saved Jobs",
                bg: "green",
                link: "/saved-jobs",
                count: allSavedJobList.length,
              },
              {
                label: "Invite",
                bg: "orange",
                link: "/invite",
                count: allInviteLists.length,
              },
              {
                label: "Interviews",
                bg: "slate",
                link: "/interviews-lists",
                count: jobInterview.length,
              }
            );
            break;
          default:
            break;
        }

        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: dashboardData,
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, error });
    }
  }
};
module.exports = { getDashboardLists };
