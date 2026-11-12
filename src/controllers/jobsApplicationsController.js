const mongoose = require("mongoose");
const { USER_TYPES } = require("../constants/constants");
const { sendEmail } = require("../functions/utils");
const EmployeeOnboarding = require("../models/employeeModel");
const JobsApplications = require("../models/jobsApplicationModel");
const JobsApplication = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const Notifications = require("../models/notificatonModel");
const Users = require("../models/userModel");
// NOTE: this controller used to `require("./jobsController")` for `updateJobs`
// even though the function was never used here. jobsController also requires
// this module, so the two-way require produced a circular-dependency warning
// on every boot ("Accessing non-existent property 'updateJobs'"). The unused
// import was removed to keep the dependency graph one-directional.

const addJobsApplications = async (req, res) => {
  try {
    const {
      companyId,
      jobId,
      clientId,
      resume,
      employeeId,
      status,
      coverNote,
      portfolioUrl,
      screeningAnswers,
    } = req.body;
    let type = "vendor";
    let isJobApplided;
    if (employeeId) {
      isJobApplided = await JobsApplication.find({
        companyId: companyId,
        employeeId: employeeId,
        jobId: jobId,
      });
    } else {
      isJobApplided = await JobsApplication.find({
        companyId: companyId,
        jobId: jobId,
      });
      type = "jobseeker";
    }
    const job = await Jobs.findOne({ _id: jobId });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    if (isJobApplided.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Job already applied with this employee",
      });
    }
    const resolvedClientId = String(clientId || job.companyId || job.clientId || companyId || "");
    const jobsApplicationObj = await JobsApplication.create({
      companyId,
      jobId,
      clientId: resolvedClientId,
      resume,
      employeeId,
      status: status || "ACTIVE",
      coverNote,
      portfolioUrl,
      screeningAnswers,
    });

    const user = await Users.findOne({ _id: companyId }).catch(() => null);
    const client = resolvedClientId
      ? await Users.findOne({ _id: resolvedClientId }).catch(() => null)
      : null;
    const applicantName = user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Applicant"
      : "Applicant";

    if (jobsApplicationObj && job) {
      await Jobs.updateOne(
        { _id: jobId },
        {
          $inc: { applicationsCount: 1 },
          $set: {
            lastApplicationAt: new Date(),
          },
        }
      ).catch((err) => console.error("Jobs.updateOne error:", err));
    }
    if (jobsApplicationObj && employeeId) {
      await EmployeeOnboarding.updateOne(
        { _id: employeeId },
        {
          $inc: { applicationCount: 1 },
          $set: {
            lastApplicationAt: new Date(),
          },
        }
      ).catch((err) => console.error("EmployeeOnboarding.updateOne error:", err));
    }

    if (jobsApplicationObj) {
      if (resolvedClientId) {
        try {
          await Notifications.create({
            userId: resolvedClientId,
            type: "JobApplication",
            notificationDetail: jobsApplicationObj?._id,
            title: "Application Received",
            details: `New Job application has been received for your job ${job?.jobTitle || "opening"} from ${applicantName}.`,
          });
        } catch (notifErr) {
          console.error("Notifications.create error:", notifErr);
        }
      }

      if (client && client.email) {
        try {
          const payload = {
            subject: "New Job Application Received",
            emailbody: `<!DOCTYPE html>
        <html lang="en">
        
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Hire In Second</title>
        </head>
        <body bgcolor="#0f3462" style="margin-top:20px;margin-bottom:20px;border-radius:20px">
          <!-- Main table -->
          <table border="0" align="center" cellspacing="0" cellpadding="0" bgcolor="white" width="650">
            <tr>
              <td>
                <!-- Child table -->
                <table border="0" cellspacing="0" cellpadding="0" style="color:#0f3462; font-family: sans-serif;">
                  <tr>
                    <td>
                      <h2 style="text-align:center; margin: 0px; padding-bottom: 25px; margin-top: 25px;">
                       Hire In<span style="color:lightcoral">&nbsp;Second</span></h2>
                    </td>
                  </tr>
                  <tr>
                    <td>
                  
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align: center;">
                      <h1 style="margin: 0px;padding-bottom: 25px; text-transform: uppercase;">New Job Application Received</h1>
                      
                      <p style=" margin: 0px 40px;padding-bottom: 25px;line-height: 2; font-size: 15px;">You received a new application for your job <b>${job?.jobTitle || ""
          }</b> from <b>${applicantName}</b>
                      </p>             
                    </td>
                  </tr>
                  <tr>
                    <td>
                    <a href="${(process.env.INVITE_LINK || "") + jobsApplicationObj?._id
          }" class="type="button" style="background-color:#36b445; color:white; padding:15px 97px; outline: none; display: block; margin: auto; border-radius: 31px;
                    font-weight: bold;text-align:center; margin-left:20px;margin-right:20px; margin-top: 25px; margin-bottom: 25px; border: none; text-transform:uppercase">View Application</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center;">
                      <h2 style="padding-top: 25px; line-height: 1; margin:0px;">Need Help?</h2>
                      <div style="margin-bottom: 25px; font-size: 15px;margin-top:7px;">Connect with us at <b>supports@hireinsecond.com</b>
                      </div>
                    </td>
                  </tr>
                </table>
                <!-- /Child table -->
              </td>
            </tr>
          </table>
          <!-- / Main table -->
        </body>
        
        </html>`,
            bodyType: "html",
            toEmail: `${client.email}`,
          };
          await sendEmail(payload);
        } catch (emailErr) {
          console.error("sendEmail error:", emailErr);
        }
      }

      return res.status(200).json({
        success: true,
        message: "JobsApplication added successfully",
        data: jobsApplicationObj,
      });
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to add job application",
      error,
    });
  }
};

const getComanyName = async (id) => {
  const data = await Users.findById(id);
  return data?.companyName;
};
let getJobslist = async (id) => {
  const data = await Jobs.findOne({ _id: id });
  let data2 = {};
  const user = await Users.findById(data?.companyId);
  data2.profilePic = user?.profilePic;
  data2.companyId = data?.companyId;
  data2.country = data?.country;
  data2.companyName = await getComanyName(data?.companyId);
  data2.jobType = data?.jobType;
  data2.jobTitle = data?.jobTitle;
  data2.jobDescription = data?.jobDescription;
  data2.jobLocation = data?.jobLocation;
  data2.positions = data?.positions;
  data2.requiredSkills = data?.requiredSkills;
  data2.qualification = data?.qualification;
  data2.noticePeriod = data?.noticePeriod;
  data2.budget = data?.budget;
  data2.jobId = data?._id;
  data2.experience = data?.experience;
  data2.createdAt = data?.createdAt;
  data2.currency = data?.currency;
  data2.probabation = data?.probabation;
  data2.paymentTerms = data?.paymentTerms;
  data2.paymentType = data?.paymentType;
  data2.isPremiumClient = data?.isPremiumClient;
  data2.salary = data?.salary;
  data2.applicationType = data?.applicationType;
  data2.displayCompanyName = data?.displayCompanyName || data?.companyName;

  return data2;
};

let getVendorlist = async (id) => {
  const data = await Users.findOne({ _id: id, status: true });
  let data2 = {};
  data2.firstName = data?.firstName;
  data2.lastName = data?.lastName;
  data2.comanyName = data?.comanyName;
  data2.country = data?.country;
  data2.email = data?.email;
  data2.vendorId = data?._id;
  data2.skills = data?.skills;
  data2.resumeData = data?.resumeData;
  data2.profilePic = data?.profilePic;
  return data2;
};
let getemployeeList = async (id) => {
  console.log(id, "ididididi");
  const data = await EmployeeOnboarding.findOne({ _id: id });
  console.log(data);
  let data2 = {};
  if (data) {
    data2.employeeId = id;
    data2.name = data.name;
    data2.budget = data.budget;
    data2.skills = data.skills;
    data2.exprience = data.exprience;
    data2.joiningEstimate = data.joiningEstimate;
    data2.resume = data.resume;
    data2.status = data.status;
    data2.profilePic = data.profilePic;
    data2.country = data.country;
  }
  return data2;
};

let getEmployee = async (id, applicationId) => {
  const data = await EmployeeOnboarding.findOne({ _id: id });
  let data2 = {};
  if (data) {
    data2.employeeId = id;
    data2.name = data.name;
    data2.budget = data.budget;
    data2.skills = data.skills;
    data2.exprience = data.exprience;
    data2.joiningEstimate = data.joiningEstimate;
    data2.resume = data.resume;
    data2.applicationId = applicationId;
    data2.status = data?.status;
    data2.profilePic = data?.profilePic;
  }
  return data2;
};
const getJobsApplications = async (req, res) => {
  const companyId = req.query.companyId; // Personal or vendor id
  const clientId = req.query.clientId; // Client id
  // const jobId = req.query.jobId; // Default to limit 10 if not provided
  const userType = req.query.userType;
  // const status = req.query.status || "ACTIVE";
  const id = req.query.id; // Job id

  // Every branch below is keyed on (userType, id). When none matches the
  // branch silently never responded - the request hung until the client
  // gave up. Answer the mismatch instead.
  const handled =
    userType === "admin" ||
    (id && userType === USER_TYPES.CLIENT) ||
    (id && (userType === USER_TYPES.COMPANY || userType === USER_TYPES.INDIVIDUAL)) ||
    (id && userType === USER_TYPES.PERSONAL) ||
    userType === USER_TYPES.CLIENT ||
    userType === USER_TYPES.COMPANY ||
    userType === USER_TYPES.INDIVIDUAL ||
    userType === USER_TYPES.PERSONAL;
  if (!handled) {
    return res.status(400).json({
      success: false,
      message:
        "userType (admin/client/company/individual/personal) and/or id is required",
    });
  }

  let arr = [];
  try {
    if (userType === "admin") {
      const jobApplicationOfclient = await JobsApplication.find();
      console.log(jobApplicationOfclient);
      const a = Promise.all(
        jobApplicationOfclient.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.vendorDetails = await getVendorlist(element.companyId);
          obj.applicationId = element._id;
          obj.employeeList = await getemployeeList(element.employeeId);
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          arr.push(obj);
        })
      );
      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
    }
    if (id && userType === USER_TYPES.CLIENT) {
      const jobApplicationByJobId = await JobsApplication.find({
        jobId: id,
        isActive: { $ne: false }
      });
      const a = Promise.all(
        jobApplicationByJobId.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.vendorDetails = await getVendorlist(element.companyId);
          obj.applicationId = element._id;
          obj.employeeList = await getemployeeList(element.employeeId);
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          obj.rejectedReason = element?.reason ?? "";
          arr.push(obj);
        })
      );
      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
      return;
    }

    if (
      id &&
      (userType === USER_TYPES.COMPANY || userType === USER_TYPES.INDIVIDUAL)
    ) {
      const jobApplicationByJobId = await JobsApplication.find({
        jobId: id,
      });
      const a = Promise.all(
        jobApplicationByJobId.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.vendorDetails = await getVendorlist(element.clientId);
          obj.applicationId = element._id;
          obj.employeeList = await getemployeeList(element.employeeId);
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          obj.rejectedReason = element?.reason ?? "";
          arr.push(obj);
        })
      );
      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
      return;
    }

    if (id && userType === USER_TYPES.PERSONAL) {
      const jobApplicationByJobId = await JobsApplication.find({
        jobId: id,
      });
      const a = Promise.all(
        jobApplicationByJobId.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.clientDetails = await getVendorlist(element.companyId);
          obj.applicationId = element._id;
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          obj.rejectedReason = element?.reason ?? "";
          arr.push(obj);
        })
      );
      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
      return;
    }
    if (userType === USER_TYPES.CLIENT) {
      const jobApplicationOfclient = await JobsApplication.find({
        clientId: clientId,
      });
      const a = Promise.all(
        jobApplicationOfclient.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.vendorDetails = await getVendorlist(element.companyId);
          obj.applicationId = element._id;
          obj.employeeList = await getemployeeList(element.employeeId);
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          obj.rejectedReason = element?.reason ?? "";
          arr.push(obj);
        })
      );
      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
    }

    if (userType === USER_TYPES.COMPANY || userType === USER_TYPES.INDIVIDUAL) {
      const jobApplicationOfclient = await JobsApplication.find({
        companyId: companyId,
      });

      const a = Promise.all(
        jobApplicationOfclient.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.clientDetails = await getVendorlist(element.clientId);
          obj.applicationId = element._id;
          obj.employeeList = await getemployeeList(element.employeeId);
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          obj.rejectedReason = element?.reason ?? "";
          arr.push(obj);
        })
      );

      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
    }

    if (userType === USER_TYPES.PERSONAL) {
      const jobApplicationOfclient = await JobsApplication.find({
        companyId: companyId,
      });

      const a = Promise.all(
        jobApplicationOfclient.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.clientDetails = await getVendorlist(element.companyId);
          obj.applicationId = element._id;
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj.rejectedReason = element?.reason ?? "";
          obj._id = element._id;
          arr.push(obj);
        })
      );

      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const getJobsApplicationsV2 = async (req, res) => {
  try {
    const { pageId = 1, pageSize = 10, filters = {} } = req.query;
    const limit = parseInt(pageSize);
    const skip = (parseInt(pageId) - 1) * limit;

    const { userType, _id: userId } = req.user;

    // Allowed user types: CLIENT, PERSONAL, INDIVIDUAL, and COMPANY
    if (
      userType !== USER_TYPES.CLIENT &&
      userType !== USER_TYPES.PERSONAL &&
      userType !== USER_TYPES.INDIVIDUAL &&
      userType !== USER_TYPES.COMPANY
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This API is restricted to Client, Personal, Individual, and Company users.",
      });
    }

    // Parse filters
    const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;

    const matchStage = {
      isActive: { $ne: false } // Default to true, include undefined if any (though default in schema is true)
    };

    if (userType === USER_TYPES.CLIENT) {
      matchStage.clientId = userId.toString();
    } else if (userType === USER_TYPES.PERSONAL) {
      matchStage.companyId = userId.toString();
    } else if (
      userType === USER_TYPES.INDIVIDUAL ||
      userType === USER_TYPES.COMPANY
    ) {
      matchStage.companyId = userId.toString();
    }

    // Filter by Employee ID
    if (parsedFilters.employeeId) {
      matchStage.employeeId = parsedFilters.employeeId;
    }

    // Filter by Application ID
    if (parsedFilters.applicationId) {
      try {
        matchStage._id = new mongoose.Types.ObjectId(parsedFilters.applicationId);
      } catch (e) {
        // invalid object id, ignore or handle
      }
    }

    // Filter by Status
    if (parsedFilters.status) {
      matchStage.status = parsedFilters.status;
    }

    // Filter by Job ID
    if (parsedFilters.jobId) {
      matchStage.jobId = parsedFilters.jobId;
    }

    // Filter by Freshness (sentAt)
    if (parsedFilters.applicationFreshness) {
      const now = new Date();
      let pastDate = new Date();
      const freshness = parsedFilters.applicationFreshness;

      if (freshness === '1h') pastDate.setHours(now.getHours() - 1);
      else if (freshness === '24h') pastDate.setHours(now.getHours() - 24);
      else if (freshness === '7d') pastDate.setDate(now.getDate() - 7);
      else if (freshness === '30d') pastDate.setDate(now.getDate() - 30);
      else if (freshness === 'All') pastDate = null;

      if (pastDate) {
        matchStage.sentAt = { $gte: pastDate };
      }
    }

    // Filter by Last Updated (lastUpdatedAt)
    if (parsedFilters.lastUpdatedAt) {
      const now = new Date();
      let pastDate = new Date();
      const freshness = parsedFilters.lastUpdatedAt;

      if (freshness === '1h') pastDate.setHours(now.getHours() - 1);
      else if (freshness === '24h') pastDate.setHours(now.getHours() - 24);
      else if (freshness === '7d') pastDate.setDate(now.getDate() - 7);
      else if (freshness === '30d') pastDate.setDate(now.getDate() - 30);
      else if (freshness === 'All') pastDate = null;

      if (pastDate) {
        matchStage.lastUpdatedAt = { $gte: pastDate };
      }
    }

    const pipeline = [
      { $match: matchStage },
      // For sorting: use lastUpdatedAt if exists, otherwise fall back to sentAt (application date)
      {
        $addFields: {
          sortableLastUpdatedAt: { $ifNull: ["$lastUpdatedAt", "$sentAt"] }
        }
      },
      { $sort: { [parsedFilters.sortBy === 'lastUpdatedAt' ? 'sortableLastUpdatedAt' : (parsedFilters.sortBy || 'sortableLastUpdatedAt')]: -1 } },

      // Lookup Job Details
      {
        $lookup: {
          from: "jobs",
          let: { jobIdVal: { $toObjectId: "$jobId" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$jobIdVal"] } } }
          ],
          as: "jobDetails"
        }
      },
      { $unwind: { path: "$jobDetails", preserveNullAndEmptyArrays: true } },

      // Conditional Lookups and Fields based on User Type
      ...(userType === USER_TYPES.CLIENT ? [
        // Lookup Employee
        {
          $lookup: {
            from: "employeeonboardings",
            let: { empId: { $toObjectId: "$employeeId" } },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$empId"] } } }
            ],
            as: "employeeDetails"
          }
        },
        { $unwind: { path: "$employeeDetails", preserveNullAndEmptyArrays: true } },

        // Lookup User (Applicant)
        {
          $lookup: {
            from: "users",
            let: { compId: { $toObjectId: "$companyId" } },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$compId"] } } }
            ],
            as: "applicantDetails"
          }
        },
        { $unwind: { path: "$applicantDetails", preserveNullAndEmptyArrays: true } },

        {
          $addFields: {
            applicantFullName: {
              $cond: {
                if: { $ifNull: ["$employeeDetails", false] },
                then: "$employeeDetails.name",
                else: { $concat: ["$applicantDetails.firstName", " ", "$applicantDetails.lastName"] }
              }
            },
            applicantFirstName: {
              $cond: {
                if: { $ifNull: ["$employeeDetails", false] },
                then: "$employeeDetails.name",
                else: "$applicantDetails.firstName"
              }
            },
            applicantLastName: {
              $cond: {
                if: { $ifNull: ["$employeeDetails", false] },
                then: "",
                else: "$applicantDetails.lastName"
              }
            }
          }
        }
      ] : []),

      // Keyword Filter
      ...(parsedFilters.keyword ? [{
        $match: {
          $or: [
            // Client: Search Applicant Name/ID
            ...(userType === USER_TYPES.CLIENT ? [
              { applicantFirstName: { $regex: parsedFilters.keyword, $options: "i" } },
              { applicantLastName: { $regex: parsedFilters.keyword, $options: "i" } },
              { applicantFullName: { $regex: parsedFilters.keyword, $options: "i" } },
              { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: parsedFilters.keyword, options: "i" } } }
            ] : []),
            // Personal/Individual/Company: Search Company, Job Title, App ID
            ...(userType === USER_TYPES.PERSONAL ||
              userType === USER_TYPES.INDIVIDUAL ||
              userType === USER_TYPES.COMPANY
              ? [
                {
                  $or: [
                    {
                      "jobDetails.selectionType": "phaseA",
                      "jobDetails.displayCompanyName": {
                        $regex: parsedFilters.keyword,
                        $options: "i",
                      },
                    },
                    {
                      "jobDetails.selectionType": { $ne: "phaseA" },
                      "jobDetails.companyName": {
                        $regex: parsedFilters.keyword,
                        $options: "i",
                      },
                    },
                  ],
                },
                {
                  "jobDetails.jobTitle": {
                    $regex: parsedFilters.keyword,
                    $options: "i",
                  },
                },
                {
                  $expr: {
                    $regexMatch: {
                      input: { $toString: "$_id" },
                      regex: parsedFilters.keyword,
                      options: "i",
                    },
                  },
                },
              ]
              : []),
          ]
        }
      }] : []),

      // Lookup Interview Count
      {
        $lookup: {
          from: "jobsinterviews",
          let: { appId: { $toString: "$_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$applicationId", "$$appId"] } } },
            { $count: "count" }
          ],
          as: "interviewCount"
        }
      },
      { $unwind: { path: "$interviewCount", preserveNullAndEmptyArrays: true } },
      { $addFields: { interviewCount: { $ifNull: ["$interviewCount.count", 0] } } },

      // Lookup Latest Interview
      {
        $lookup: {
          from: "jobsinterviews",
          let: { appId: { $toString: "$_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$applicationId", "$$appId"] }, isActive: { $ne: false } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "latestInterview"
        }
      },
      { $unwind: { path: "$latestInterview", preserveNullAndEmptyArrays: true } },

      // Filter by isInterview
      ...(parsedFilters.isInterview ? [{
        $match: {
          interviewCount: { $gt: 0 }
        }
      }] : []),

      // Facet for pagination
      {
        $facet: {
          metadata: [{ $count: "total" }],
          activeCount: [
            {
              $match: {
                status: {
                  $nin: [
                    "REJECTED",
                    "CLOSED",
                    "WITHDRAWN",
                    "ONBOARDED",
                    "OFFER",
                    "HIRED"
                  ]
                }
              }
            },
            { $count: "total" }
          ],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                applicationId: "$_id",
                status: 1,
                resume: 1,
                coverNote: 1,
                portfolioUrl: 1,
                screeningAnswers: 1,
                sentAt: 1,
                lastUpdatedAt: 1,
                viewedAt: 1,
                lastInterviewAt: 1,
                reason: 1,
                interviewCount: 1,
                latestInterview: 1,
                jobId: 1,
                clientId: 1,
                companyId: 1,
                employeeId: 1,

                // Fields for Client
                ...(userType === USER_TYPES.CLIENT ? {
                  "jobDetails._id": 1,
                  "jobDetails.jobTitle": 1,
                  "jobDetails.companyName": 1,
                  "jobDetails.profilePic": 1,
                  "jobDetails.jobType": 1,
                  "jobDetails.jobLocation": 1,
                  employeeDetails: 1,
                  applicantDetails: 1,
                  applicantFullName: 1
                } : {}),

                // Fields for Personal/Individual/Company
                ...(userType === USER_TYPES.PERSONAL ||
                  userType === USER_TYPES.INDIVIDUAL ||
                  userType === USER_TYPES.COMPANY
                  ? {
                    "jobDetails._id": 1,
                    "jobDetails.jobTitle": 1,
                    "jobDetails.companyName": 1,
                    "jobDetails.profilePic": 1,
                    "jobDetails.displayCompanyName": 1,
                    "jobDetails.jobLocation": 1,
                    "jobDetails.jobType": 1,
                    "jobDetails.salary": 1,
                    "jobDetails.budget": 1,
                    "jobDetails.currency": 1,
                  }
                  : {})
              }
            }
          ]
        }
      }
    ];

    const result = await JobsApplication.aggregate(pipeline);

    const data = result[0].data;
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const activeTotal =
      result[0].activeCount && result[0].activeCount[0]
        ? result[0].activeCount[0].total
        : 0;

    const isPersonalUser =
      userType === USER_TYPES.PERSONAL ||
      userType === USER_TYPES.INDIVIDUAL;
    const reportedTotal =
      isPersonalUser && !parsedFilters.status ? activeTotal : total;

    const formattedData = data.map(item => {
      const jobDetails = {
        jobId: item.jobDetails?._id || item.jobId,
        jobTitle: item.jobDetails?.jobTitle,
        companyName: item.jobDetails?.companyName || item.jobDetails?.displayCompanyName,
        displayCompanyName: item.jobDetails?.displayCompanyName,
        profilePic: item.jobDetails?.profilePic,
        jobLocation: item.jobDetails?.jobLocation,
        jobType: item.jobDetails?.jobType,
        salary: item.jobDetails?.salary,
        budget: item.jobDetails?.budget,
        currency: item.jobDetails?.currency,
      };

      if (
        userType === USER_TYPES.PERSONAL ||
        userType === USER_TYPES.INDIVIDUAL ||
        userType === USER_TYPES.COMPANY
      ) {
        return {
          applicationId: item._id,
          status: item.status,
          resume: item.resume,
          coverNote: item.coverNote || "",
          portfolioUrl: item.portfolioUrl || "",
          screeningAnswers: item.screeningAnswers || null,
          sentAt: item.sentAt,
          lastUpdatedAt: item.lastUpdatedAt,
          viewedAt: item.viewedAt || null,
          lastInterviewAt: item.lastInterviewAt,
          rejectedReason: item.reason || "",
          interviewCount: item.interviewCount || 0,
          latestInterview: item.latestInterview || null,
          jobId: item.jobId,
          clientId: item.clientId,
          companyId: item.companyId,
          employeeId: item.employeeId,
          jobDetails
        };
      }

      // Default Client Format
      const directCandidateName = item.screeningAnswers?.fullName || "";
      const nameParts = directCandidateName.trim().split(/\s+/);
      const directFirst = nameParts[0] || "";
      const directLast = nameParts.slice(1).join(" ");

      return {
        applicationId: item._id,
        status: item.status,
        resume: item.resume,
        coverNote: item.coverNote || "",
        portfolioUrl: item.portfolioUrl || "",
        screeningAnswers: item.screeningAnswers || null,
        sentAt: item.sentAt,
        lastUpdatedAt: item.lastUpdatedAt,
        viewedAt: item.viewedAt || null,
        lastInterviewAt: item.lastInterviewAt,
        rejectedReason: item.reason || "",
        interviewCount: item.interviewCount || 0,
        latestInterview: item.latestInterview || null,
        jobId: item.jobId,
        clientId: item.clientId,
        companyId: item.companyId,
        employeeId: item.employeeId || null,
        jobDetails,
        vendorDetails: {
          firstName: item.applicantDetails?.firstName || directFirst || "",
          lastName: item.applicantDetails?.lastName || directLast || "",
          profilePic: item.applicantDetails?.profilePic || "",
          employeeId: item.employeeId || null,
          employeeName: item.employeeDetails?.name || directCandidateName || ""
        },
      };
    });

    res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: formattedData,
      totalCount: reportedTotal,
      rawTotalCount: total,
      activeCount: activeTotal,
      totalPages: Math.ceil(reportedTotal / limit)
    });
  } catch (error) {
    console.error("getJobsApplicationsV2 Error:", error);
    res.status(500).json({ success: false, error });
  }
}

const updateApplicatonJobs = async (req, res) => {
  try {
    const { applicationId, status, reason, salary, joiningDate, interviewer } = req.body;
    const application = await JobsApplication.findOne({ _id: applicationId });
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }
    const jobData = await Jobs.findOne({ _id: application.jobId });
    const salaryPer = (jobData?.paymentTerms || 1) - 1;
    const budget = jobData?.budget || 0;
    const user = await Users.findOne({ _id: application.companyId });

    if (status === "ONBOARDED") {
      const parsedSalary = salary ? Number(String(salary).replace(/[^\d.]/g, "")) : 0;
      const finalSalary = parsedSalary > 0 ? parsedSalary : (Number(budget) || 0);

      if (application.employeeId && application.employeeId !== "") {
        const data = await EmployeeOnboarding.findOne({
          _id: application.employeeId,
        });

        if (data) {
          data.alloted = true;
          data.salary = finalSalary;
          if (joiningDate) data.joiningDate = String(joiningDate);
          await data.save();
        }
      } else {
        const candidateId = application.candidateId || application.userId || application.companyId;
        const data = await Users.findOne({
          _id: candidateId,
        });
        if (data) {
          data.alloted = true;
          data.salary = finalSalary;
          if (joiningDate) data.joiningDate = String(joiningDate);
          await data.save();
        }
      }

      const job = await Jobs.findOne({ _id: application.jobId });
      if (job) {
        let leftPositions = Math.max((Number(job.positions) || 0) - 1, 0);
        job.positions = leftPositions.toString();
        await job.save();
      }
    }

    application.status = status;
    application.reason = reason ?? "";
    if (joiningDate) application.contractDate = String(joiningDate);
    if (interviewer) application.interviewers = String(interviewer);
    if (salary) {
      const parsedSalary = Number(String(salary).replace(/[^\d.]/g, ""));
      if (parsedSalary > 0) application.budgetPercentage = String(parsedSalary);
    }
    application.lastUpdatedAt = new Date();
    await application.save();

    if (status === "WITHDRAWN") {
      try {
        await Notifications.create({
          userId: application.companyId,
          type: "JobApplication",
          notificationDetail: applicationId,
          title: "Application Withdrawn",
          details: `Your application for job #${jobData?._id || applicationId} (${jobData?.jobTitle || "role"}) has been withdrawn`,
        });
        if (application.clientId) {
          await Notifications.create({
            userId: application.clientId,
            type: "JobApplication",
            notificationDetail: applicationId,
            title: "Application Withdrawn",
            details: `Candidate ${user?.firstName || ""} ${user?.lastName || ""} withdrew their application for ${jobData?.jobTitle || "the position"}`,
          });
        }
      } catch (notifErr) {
        console.error("Error creating withdrawal notifications:", notifErr);
      }

      return res.status(200).json({
        success: true,
        message: "Application withdrawn successfully",
      });
    }

    const notifications = await Notifications.create({
      userId: application.companyId,
      type: "JobApplication",
      notificationDetail: applicationId,
      title: `${status === "ONBOARDED"
        ? "Applicant Onboarded 🎉"
        : status === "REJECTED"
          ? "Application Rejected"
          : "Application Accepted"
        }`,
      details:
        status === "ONBOARDED"
          ? `Congratulations 🎉 You are selected for job #${jobData._id} (${jobData?.jobTitle}). Client will contact you for further proccess`
          : status === "REJECTED"
            ? `Your application for job #${jobData._id} (${jobData?.jobTitle}) has been rejected`
            : `Congratulations 🎉 Your application for job #${jobData._id} (${jobData?.jobTitle}) has been accepted. Client will contact you for further proccess`,
    });

    if (status === "ONBOARDED") {
      await Notifications.create({
        userId: application.companyId,
        type: "APPLICATION_ONBOARDED",
        notificationDetail: applicationId,
        title: "Application Onboarded 🎉",
        details: `Candidate: ${(user?.firstName || "") + " " + (user?.lastName || "")} has been onboarded for job #${jobData._id} (${jobData?.jobTitle})`,
      });
    }

    const payload = {
      subject:
        status === "ONBOARDED"
          ? "Applicant Onboarded 🎉"
          : status === "REJECTED"
            ? "Application Rejected"
            : "Application Accepted",
      emailbody: `<!DOCTYPE html>
      <html lang="en">
      
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hire In Second</title>
      </head>
      <body bgcolor="#0f3462" style="margin-top:20px;margin-bottom:20px;border-radius:20px">
        <!-- Main table -->
        <table border="0" align="center" cellspacing="0" cellpadding="0" bgcolor="white" width="650">
          <tr>
            <td>
              <!-- Child table -->
              <table border="0" cellspacing="0" cellpadding="0" style="color:#0f3462; font-family: sans-serif;">
                <tr>
                  <td>
                    <h2 style="text-align:center; margin: 0px; padding-bottom: 25px; margin-top: 25px;">
                     Hire In<span style="color:lightcoral">&nbsp;Second</span></h2>
                  </td>
                </tr>
                <tr>
                  <td>
                
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center;">
                    <h1 style="margin: 0px;padding-bottom: 25px; text-transform: uppercase;">${status === "ONBOARDED"
          ? "Applicant Onboarded 🎉"
          : status === "REJECTED"
            ? "Application Rejected"
            : "Application Accepted"
        }</h1>
              <p style=" margin: 10px 60px;padding-bottom: 25px;line-height: 2; font-size: 15px;text-align: start;">Hi, ${user.firstName + user.lastName
        }
                    </p>          
                    <p style=" margin: 0px 40px;padding-bottom: 25px;line-height: 2; font-size: 15px;"> ${status === "ONBOARDED"
          ? `Congratulations 🎉 You are selected for job #${jobData._id} (${jobData?.jobTitle}). Client will contact you for further proccess`
          : status === "REJECTED"
            ? `Your application for job #${jobData._id} (${jobData?.jobTitle}) has been rejected`
            : `Congratulations 🎉 Your application for job #${jobData._id} (${jobData?.jobTitle}) has been accepted. Client will contact you for further proccess`
        }
                    </p>             
                  </td>
                </tr>
                <tr>
                  <td>
                  <a href=${process.env.INVITE_LINK + application?._id
        } class="type="button" style="background-color:#36b445; color:white; padding:15px 97px; outline: none; display: block; margin: auto; border-radius: 31px;
                  font-weight: bold;text-align:center; margin-left:20px;margin-right:20px; margin-top: 25px; margin-bottom: 25px; border: none; text-transform:uppercase">View Application</a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;">
                    <h2 style="padding-top: 25px; line-height: 1; margin:0px;">Need Help?</h2>
                    <div style="margin-bottom: 25px; font-size: 15px;margin-top:7px;">Connect with us at <b>supports@hireinsecond.com</b>
                    </div>
                  </td>
                </tr>
              </table>
              <!-- /Child table -->
            </td>
          </tr>
        </table>
        <!-- / Main table -->
      </body>
      
      </html>`,
      bodyType: "html",
      toEmail: `${user.email}`,
    };
    await sendEmail(payload);
    return res.status(200).json({
      success: true,
      message: "Successfully uploaded",
    });
    return res.status(200).json({
      success: true,
      message: "Successfully updated",
    });
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to add job application",
      error,
    });
  }
};

const getJobApplicationById = async (req, res) => {
  const id = req.params.id;
  const userType = req.query.userType || req.user?.userType;
  try {
    let obj = {};
    const data = await JobsApplications.findById(id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }
    obj.jobDetails = await getJobslist(data.jobId);
    if (
      userType === USER_TYPES.PERSONAL ||
      userType === USER_TYPES.INDIVIDUAL ||
      userType === USER_TYPES.COMPANY
    ) {
      obj.clientDetails = data.clientId ? await getVendorlist(data.clientId) : null;
    } else {
      obj.vendorDetails = data.companyId ? await getVendorlist(data.companyId) : null;
      if (userType === USER_TYPES.CLIENT && obj.vendorDetails) {
        delete obj.vendorDetails.email;
      }
    }

    if (userType === USER_TYPES.CLIENT && !data.viewedAt) {
      data.viewedAt = new Date();
      if (data.status === "ACTIVE") {
        data.status = "UNDER_REVIEW";
      }
      await data.save().catch((e) => console.error("Save viewedAt error:", e));
    }

    const JobsInterview = require("../models/mettingModel");
    obj.interviews = await JobsInterview.find({
      applicationId: String(data._id),
      isActive: { $ne: false },
    }).sort({ createdAt: -1 });

    obj.applicationId = data._id;
    obj._id = data._id;
    obj.jobId = data.jobId;
    obj.companyId = data.companyId;
    obj.employeeId = data.employeeId;
    obj.clientId = data.clientId;
    obj.employeeList = data.employeeId ? await getemployeeList(data.employeeId) : null;
    if (obj.employeeList?.name) {
      if (!obj.vendorDetails) obj.vendorDetails = {};
      obj.vendorDetails.employeeName = obj.employeeList.name;
      obj.vendorDetails.employeeId = data.employeeId;
    }
    obj.status = data.status;
    obj.resume = data.resume;
    obj.sentAt = data.sentAt;
    obj.lastUpdatedAt = data.lastUpdatedAt;
    obj.viewedAt = data.viewedAt || null;
    obj.lastInterviewAt = data.lastInterviewAt;
    obj.screeningAnswers = data.screeningAnswers || null;
    obj.coverNote = data.coverNote || "";
    obj.portfolioUrl = data.portfolioUrl || "";
    obj.reason = data?.reason ?? "";
    obj.isActive = data.isActive;

    return res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: obj,
    });
  } catch (error) {
    console.error("getJobApplicationById error:", error);
    res.status(500).json({ success: false, error });
  }
};

const getOnboaredApplication = async (req, res) => {
  const id = req.query.id;
  const userType = req.query.userType;
  if (!id || !userType) {
    return res.status(400).json({ message: "Bad Request" });
  }
  let arr = [];
  try {
    if (id && userType === USER_TYPES.CLIENT) {
      const onboardedData = await JobsApplication.find({
        clientId: id,
        status: "ONBOARDED",
      });
      const a = Promise.all(
        onboardedData.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.vendorDetails = await getVendorlist(element.companyId);
          obj.applicationId = element._id;
          obj.employeeList = await getemployeeList(element.employeeId);
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          obj.rejectedReason = element?.reason ?? "";
          arr.push(obj);
        })
      );
      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
      return;
    }

    if (
      id &&
      (userType === USER_TYPES.COMPANY || userType === USER_TYPES.INDIVIDUAL)
    ) {
      const onboardedData = await JobsApplication.find({
        companyId: id,
        status: "ONBOARDED",
      });
      const a = Promise.all(
        onboardedData.map(async (element) => {
          const obj = {};
          obj.jobDetails = await getJobslist(element.jobId);
          obj.vendorDetails = await getVendorlist(element.clientId);
          obj.applicationId = element._id;
          obj.employeeList = await getemployeeList(element.employeeId);
          obj.status = element.status;
          obj.resume = element.resume;
          obj.sentAt = element.sentAt;
          obj._id = element._id;
          obj.rejectedReason = element?.reason ?? "";
          arr.push(obj);
        })
      );
      a.then(() => {
        res.status(200).json({
          success: true,
          message: "Successfully fetched data",
          data: arr,
        });
      }).catch((error) => {
        console.error(error); // Handle errors if any
      });
      return;
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};
const updateAplicationOfJob = async (req, res) => {
  const {
    applicationId,
    resume,
    budgetPercentage,
    contractDate,
    userType,
    types,
  } = req.body;
  try {
    const data = await JobsApplications.findOne({ _id: applicationId });
    if (types === "resume") {
      data.resume = resume;
      data.save();
      return res
        .status(200)
        .json({ success: true, message: "Updated Successfully" });
    }
    data.contractDate = contractDate ?? data.contractDate;

    if (userType !== USER_TYPES.PERSONAL) {
      const resp = await EmployeeOnboarding.findOne({
        _id: data?.employeeId,
      });

      resp.budget =
        Number(resp?.budget) +
        (Number(budgetPercentage) / 100) * Number(resp?.budget);
      data.budgetPercentage = budgetPercentage;
      resp.save();
    }
    data.save();
    res.status(200).json({ success: true, message: "Updated Successfully" });
  } catch (error) {
    res.status(500).json({ error });
  }
};

const getEmployeeListByJobId = async (req, res) => {
  const jobId = req.query.jobId;
  const companyId = req.query.companyId;
  if (!companyId || !jobId) {
    return res.status(400).json({ message: "Bad Request" });
  }

  try {
    const data = await JobsApplications.find({
      jobId: jobId,
      companyId: companyId,
    });
    let arr = [];
    const jobDetails = await getJobslist(jobId);
    const companyDetails = await getVendorlist(companyId);

    let newData = { jobDetails, companyDetails };
    const a = Promise.all(
      data.map(async (element) => {
        const emp = await getEmployee(element.employeeId, element._id);
        arr.push(emp);
      })
    );
    newData.employeeLists = arr;
    a.then(() => {
      res
        .status(200)
        .json({ message: "Successfully Fetched Record", data: newData });
    }).catch((error) => {
      console.log(error);
      res.status(500).json({ message: "Something went wrong", error });
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Something went wrong", error });
  }
};

const getEmployeeListByJobIdForClient = async (req, res) => {
  const jobId = req.query.jobId;
  const clientId = req.query.clientId;
  const status = req.query.status;

  if (!clientId || !jobId) {
    return res.status(400).json({ message: "Bad Request" });
  }

  try {
    const data = await JobsApplications.find({
      jobId: jobId,
      clientId: clientId,
      status: status,
    });
    let arr = [];
    const jobDetails = await getJobslist(jobId);
    const companyDetails = await getVendorlist(clientId);

    let newData = { jobDetails, companyDetails };
    const a = Promise.all(
      data.map(async (element) => {
        let emp = await getEmployee(element.employeeId, element._id);
        if (Object.values(emp).length === 0) {
          const userObj = await Users.findById(element?.companyId).select(
            "-password"
          );
          const newObj = {
            ...userObj?._doc,
            applicationId: element?._id,
          };
          console.log(newObj);
          emp = newObj;
        }
        arr.push(emp);
      })
    );
    newData.employeeLists = arr;
    a.then(() => {
      res
        .status(200)
        .json({ message: "Successfully Fetched Record", data: newData });
    }).catch((error) => {
      console.log(error);
      res.status(500).json({ message: "Something went wrong", error });
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Something went wrong", error });
  }
};
module.exports = {
  addJobsApplications,
  getJobsApplications,
  updateApplicatonJobs,
  getJobApplicationById,
  getJobslist,
  getVendorlist,
  getemployeeList,
  getOnboaredApplication,
  updateAplicationOfJob,
  getEmployeeListByJobId,
  getEmployeeListByJobIdForClient,
  getJobsApplicationsV2
};
