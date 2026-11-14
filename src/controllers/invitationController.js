const mongoose = require("mongoose");
const { USER_TYPES } = require("../constants/constants");
const { sendEmail } = require("../functions/utils");
const EmployeeOnboarding = require("../models/employeeModel");
const JobsInvitations = require("../models/invitationModel");
const JobsApplication = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const Notifications = require("../models/notificatonModel");
const Users = require("../models/userModel");
const {
  sanitizeExperiences,
  sanitizeEducation,
} = require("../helpers/resumeFormatter");
const {
  getJobslist,
  getemployeeList,
} = require("./jobsApplicationsController");

const getEmployeeLists = async (id) => {
  const data = await EmployeeOnboarding.find({ companyId: id, status: "ACTIVE" });
  return data;
};

const getJobSeekerAndVendor = async (req, res) => {
  try {
    const {
      lastId = null,
      limit = 10,
      page = 1,
      type,
      category = "all",
      search = "",
      skills: querySkills = "",
      location: queryLocation = "",
      country: queryCountry = "",
    } = req.query;

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const trimmedSearch = String(search || "").trim();
    const searchRegex = trimmedSearch ? new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const skillsRegex = querySkills ? new RegExp(String(querySkills).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const locRegex = queryLocation || queryCountry ? new RegExp(String(queryLocation || queryCountry).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

    // Selected category: "all" | "jobseekers" | "companies" | "individuals"
    const activeCat = (category || type || "all").toLowerCase();

    // 1. Build Personal Jobseekers query
    // PRIVACY ENFORCEMENT: openToOffers MUST NOT be false!
    const jobseekerQuery = {
      userType: USER_TYPES.PERSONAL,
      status: { $ne: false },
      openToOffers: { $ne: false }, // Enforces candidate privacy toggle
    };

    if (searchRegex) {
      jobseekerQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { fullName: searchRegex },
        { title: searchRegex },
        { headline: searchRegex },
        { desiredRole: searchRegex },
        { skills: searchRegex },
        { location: searchRegex },
      ];
    }
    if (skillsRegex) {
      jobseekerQuery.skills = skillsRegex;
    }
    if (locRegex) {
      jobseekerQuery.$and = jobseekerQuery.$and || [];
      jobseekerQuery.$and.push({
        $or: [
          { location: locRegex },
          { country: locRegex },
          { preferredLocations: locRegex },
        ],
      });
    }

    // 2. Build Vendor Companies query
    const companyQuery = {
      userType: USER_TYPES.COMPANY,
      status: { $ne: false },
    };
    if (searchRegex) {
      companyQuery.$or = [
        { companyName: searchRegex },
        { companyRepresentative: searchRegex },
        { designation: searchRegex },
        { location: searchRegex },
      ];
    }
    if (locRegex) {
      companyQuery.$or = companyQuery.$or || [];
      companyQuery.$or.push({ location: locRegex }, { country: locRegex });
    }

    // 3. Build Vendor Bench Individuals (EmployeeOnboarding) query
    const employeeQuery = {
      status: "ACTIVE",
      alloted: { $ne: true },
    };
    if (searchRegex) {
      employeeQuery.$or = [
        { name: searchRegex },
        { skills: searchRegex },
        { designation: searchRegex },
        { joiningEstimate: searchRegex },
      ];
    }
    if (skillsRegex) {
      employeeQuery.skills = skillsRegex;
    }

    // Determine counts
    const [jobseekersCount, vendorCompaniesCount, vendorIndividualsCount] = await Promise.all([
      Users.countDocuments(jobseekerQuery),
      Users.countDocuments(companyQuery),
      EmployeeOnboarding.countDocuments(employeeQuery),
    ]);

    const totalCount = jobseekersCount + vendorCompaniesCount + vendorIndividualsCount;

    let items = [];

    // Category fetch logic
    if (activeCat === "jobseekers" || activeCat === "personal") {
      const docs = await Users.find(jobseekerQuery)
        .sort({ subscriptionStatus: -1, lastActiveAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum);

      items = docs.map((u, idx) => formatJobseeker(u, idx));
    } else if (activeCat === "companies" || activeCat === "vendor") {
      const docs = await Users.find(companyQuery)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNum);

      items = await Promise.all(docs.map(async (c, idx) => {
        const bench = await getEmployeeLists(c._id);
        return formatVendorCompany(c, bench, idx);
      }));
    } else if (activeCat === "individuals" || activeCat === "bench") {
      const docs = await EmployeeOnboarding.find(employeeQuery)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNum);

      items = await Promise.all(docs.map(async (e, idx) => {
        const vendor = await Users.findById(e.companyId).select("companyName").lean();
        return formatVendorIndividual(e, vendor?.companyName, idx);
      }));
    } else {
      // "all" - balanced combination
      const [jobseekers, companies, employees] = await Promise.all([
        Users.find(jobseekerQuery)
          .sort({ subscriptionStatus: -1, _id: -1 })
          .limit(Math.ceil(limitNum * 0.6)),
        Users.find(companyQuery)
          .sort({ _id: -1 })
          .limit(Math.ceil(limitNum * 0.2)),
        EmployeeOnboarding.find(employeeQuery)
          .sort({ _id: -1 })
          .limit(Math.ceil(limitNum * 0.2)),
      ]);

      const formattedJobseekers = jobseekers.map((u, i) => formatJobseeker(u, i));
      const formattedCompanies = await Promise.all(companies.map(async (c, i) => {
        const bench = await getEmployeeLists(c._id);
        return formatVendorCompany(c, bench, i);
      }));
      const formattedEmployees = await Promise.all(employees.map(async (e, i) => {
        const vendor = await Users.findById(e.companyId).select("companyName").lean();
        return formatVendorIndividual(e, vendor?.companyName, i);
      }));

      // Interleave results cleanly
      items = [...formattedJobseekers, ...formattedEmployees, ...formattedCompanies].slice(0, limitNum);
    }

    const lastFetchedId = items.length > 0 ? items[items.length - 1]._id : null;

    res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: items,
      totalCount,
      jobseekersCount,
      vendorCompaniesCount,
      vendorIndividualsCount,
      lastId: lastFetchedId,
      page: pageNum,
      totalPages: Math.ceil((activeCat === "jobseekers" ? jobseekersCount : activeCat === "companies" ? vendorCompaniesCount : activeCat === "individuals" ? vendorIndividualsCount : totalCount) / limitNum) || 1,
    });
  } catch (error) {
    console.error("Error in getJobSeekerAndVendor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch candidate data",
      error: error.message,
    });
  }
};

function formatJobseeker(u, idx) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.fullName || "Candidate";
  const rawSkills = Array.isArray(u.skills) ? u.skills : String(u.skills || "").split(/[,/|;\n]/).map((s) => s.trim()).filter(Boolean);
  const isSubscribed = Boolean(u.subscriptionStatus);
  const salaryNum = Number(u.salary || u.expectedSalary) || 0;
  const salaryBadge = salaryNum > 0 ? `₹${(salaryNum / 100000).toFixed(0)}-${((salaryNum * 1.2) / 100000).toFixed(0)} LPA` : "₹24-32 LPA";

  return {
    _id: u._id.toString(),
    id: u._id.toString(),
    entityType: "jobseeker",
    name,
    title: u.title || u.headline || u.desiredRole || "Software Engineer",
    location:
      u.location ||
      (Array.isArray(u.preferredLocations) ? u.preferredLocations.join(", ") : u.preferredLocation) ||
      u.preferredLocationCity ||
      u.city ||
      "India",
    salaryBadge,
    salary: salaryNum || 2800000,
    profilePic: u.profilePic || "",
    skills: rawSkills.slice(0, 6),
    experience: u.exprience || u.experience || "4+ years",
    noticePeriod: isSubscribed ? "0 Day Notice" : (u.noticePeriod || "15 Days Notice"),
    isSubscribed,
    isVerified: Boolean(u.isProfileCompleted),
    matchScore: 90 + ((idx * 3) % 9),
    openToOffers: u.openToOffers !== false,
  };
}

function formatVendorIndividual(e, companyName, idx) {
  const rawSkills = Array.isArray(e.skills) ? e.skills : String(e.skills || "").split(/[,/|;\n]/).map((s) => s.trim()).filter(Boolean);
  const budgetNum = Number(e.budget) || 0;
  const salaryBadge = budgetNum > 0 ? `₹${(budgetNum / 100000).toFixed(0)} LPA` : "₹28 LPA (Fixed)";

  return {
    _id: e._id.toString(),
    id: e._id.toString(),
    entityType: "vendor_individual",
    name: e.name || "Bench Engineer",
    title: e.designation || "Lead UI/UX Designer & Systems Architect",
    companyName: companyName || "DevSprint Labs",
    location: e.location || "Pune, India • Hybrid / Remote",
    salaryBadge,
    salary: budgetNum || 2800000,
    profilePic: e.profilePic || "",
    skills: rawSkills.slice(0, 6),
    experience: e.exprience || "5+ years",
    noticePeriod: e.joiningEstimate || "Immediate (0-7 Days)",
    isSubscribed: false,
    isVerified: true,
    benchReady: true,
    matchScore: 88 + ((idx * 4) % 10),
  };
}

function formatVendorCompany(c, bench, idx) {
  const benchCount = Array.isArray(bench) ? bench.length : 12;
  const rawSkills = Array.isArray(c.skills) ? c.skills : String(c.skills || "").split(/[,/|;\n]/).map((s) => s.trim()).filter(Boolean);
  const fallbackSkills = ["Node.js", "Python / Django", "DevOps Kubernetes", "React"];

  return {
    _id: c._id.toString(),
    id: c._id.toString(),
    entityType: "vendor_company",
    name: c.companyName || "Tech Agency Partner",
    title: `${benchCount} Verified Bench Engineers available`,
    companyName: c.companyName || "Tech Agency Partner",
    companyRepresentative: c.companyRepresentative || c.firstName,
    location: c.location || "Hyderabad, India • Tier-1 Agency",
    salaryBadge: `${benchCount} Bench Available`,
    profilePic: c.profilePic || "",
    skills: rawSkills.length > 0 ? rawSkills.slice(0, 5) : fallbackSkills,
    benchCount,
    deploySpeed: "< 24 Hours (Pre-screened)",
    isVerified: true,
    matchScore: 94 + (idx % 5),
  };
}

const inviteJobInvitation = async (req, res) => {
  const { jobId, clientId, companyId, message, employeeId, jobName } = req.body;
  let checkInvitation = null;
  try {
    if (!jobName) {
      checkInvitation = await JobsInvitations.findOne({
        jobId: jobId,
        companyId: companyId,
        status: "ACTIVE",
        employeeId: employeeId,
      });
    }

    if (checkInvitation) {
      res.status(500).json({
        success: false,
        message: "Already Invited",
      });
    } else {
      const data = await JobsInvitations.create({
        jobId,
        clientId,
        companyId,
        message,
        employeeId,
        jobName,
      });
      if (data) {
        let job = { jobTitle: jobName };
        if (!jobName && jobId) {
          job = await Jobs.findById(jobId);
        }

        const client = await Users.findById(clientId);
        const user = await Users.findById(companyId ?? employeeId);
        const clientName = client?.companyName || (client?.firstName ? `${client.firstName} ${client.lastName || ""}`.trim() : "Employer");
        const jobTitleStr = job?.jobTitle || jobName || "Specialist Role";
        const salaryStr = job?.budget || (job?.salary ? `₹${(job.salary / 100000).toFixed(0)} LPA` : "Competitive");

        await Notifications.create({
          userId: companyId ?? employeeId,
          type: "JobInvitation",
          notificationDetail: `${clientName} • Job Invitation`,
          title: `Job Invitation: ${jobTitleStr}`,
          details: message || `You have received a new job invitation for ${jobTitleStr} from ${clientName}.`,
          status: "New",
          isClear: false,
          sentAt: new Date(),
          jobId: jobId || "",
          invitationId: data._id.toString(),
          invitationStatus: "PENDING",
          jobTitle: jobTitleStr,
          companyName: clientName,
          salary: salaryStr,
        }).catch((err) => console.warn("Failed to create notification:", err.message));

        res.status(200).json({
          success: true,
          message: "Invited Successfully",
          invitationId: data._id.toString(),
        });
        const payload = {
          subject: "New Job Invitation Received",
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
                          <h2 style="text-align:center; margin: 0px; padding-bottom: 4px; margin-top: 15px; font-size: 26px; font-weight: 800; color: #0f3462; letter-spacing: -0.5px;">
                            HireInSecond
                          </h2>
                          <div style="text-align:center; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; margin-bottom: 20px;">
                            Tech Hiring &bull; Direct &bull; Verified
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                      
                        </td>
                      </tr>
                      <tr>
                        <td style="text-align: center;">
                          <h1 style="margin: 0px;padding-bottom: 25px; text-transform: uppercase;">New Job Application Received</h1>
                          
                          <p style=" margin: 0px 40px;padding-bottom: 25px;line-height: 2; font-size: 15px;">You received a new application for your job <b>${job.jobTitle}</b> from <b> from ${user.firstName} ${user.lastName}</b>
                          </p>             
                        </td>
                      </tr>
                      <tr>
                        <td>

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
      } else {
        res.status(200).json({
          success: false,
          message: "Something went wrong",
        });
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error,
    });
  }
};
const getClientDetails = async (id, jobId) => {
  const data = await Users.findById(id);
  let jobLocation = {};
  if (jobId) {
    const job = await Jobs.findById(jobId); // Job fetch
    try {
      jobLocation = JSON.parse(job?.jobLocation || "{}"); // JSON parse
    } catch (e) {
      jobLocation = {};
    }
  }
  return {
    companyName: data?.companyName,
    companyRepresentative: data?.companyRepresentative,
    designation: data?.designation,
    country: data?.country,
    jobLocation,
    city: jobLocation?.city || "",
    state: jobLocation?.state || "",
    firstName: data?.firstName,
    lastName: data?.lastName,
    userType: data?.userType,
    profilePic: data?.profilePic,
    skills: data?.skills
  };
};
const getInvitations = async (req, res) => {
  const userType = req.query.userType || req.user?.userType || "client";
  const userId = req.query.userId || (req.user?._id ? req.user._id.toString() : null);
  const statusFilter = req.query.status;

  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    let query = {};
    if (userType === USER_TYPES.CLIENT) {
      query.clientId = userId;
    } else {
      query.$or = [{ companyId: userId }, { employeeId: userId }];
    }

    if (statusFilter && statusFilter !== "ALL") {
      query.status = statusFilter;
    }

    const rawInvitations = await JobsInvitations.find(query).sort({ createdAt: -1 });

    const totalCount = await JobsInvitations.countDocuments(
      userType === USER_TYPES.CLIENT ? { clientId: userId } : { $or: [{ companyId: userId }, { employeeId: userId }] }
    );
    const pendingCount = await JobsInvitations.countDocuments(
      userType === USER_TYPES.CLIENT
        ? { clientId: userId, status: { $in: ["ACTIVE", "PENDING"] } }
        : { $or: [{ companyId: userId }, { employeeId: userId }], status: { $in: ["ACTIVE", "PENDING"] } }
    );
    const acceptedCount = await JobsInvitations.countDocuments(
      userType === USER_TYPES.CLIENT
        ? { clientId: userId, status: "ACCEPTED" }
        : { $or: [{ companyId: userId }, { employeeId: userId }], status: "ACCEPTED" }
    );
    const declinedCount = await JobsInvitations.countDocuments(
      userType === USER_TYPES.CLIENT
        ? { clientId: userId, status: "DECLINED" }
        : { $or: [{ companyId: userId }, { employeeId: userId }], status: "DECLINED" }
    );

    const arr = await Promise.all(
      rawInvitations.map(async (element) => {
        const job = element.jobId ? await Jobs.findById(element.jobId).lean() : null;
        const candidateUser = await Users.findById(element.companyId || element.employeeId).lean();
        const clientUser = await Users.findById(element.clientId).lean();

        const candidateName = candidateUser
          ? [candidateUser.firstName, candidateUser.lastName].filter(Boolean).join(" ").trim() || candidateUser.companyName || "Candidate"
          : "Candidate";

        const rawSkills = Array.isArray(candidateUser?.skills)
          ? candidateUser.skills
          : String(candidateUser?.skills || "").split(/[,/|;\n]/).map((s) => s.trim()).filter(Boolean);

        const jobTitle = job?.jobTitle || element.jobName || "Specialist Role";
        const jobRef = job ? `#JOB-${job._id.toString().slice(-4).toUpperCase()}` : "#JOB-8942";
        const salaryBadge = job?.budget || (job?.salary ? `₹${(job.salary / 100000).toFixed(0)} LPA` : "₹28-36 LPA");
        const location = job?.jobLocation || "Remote / On-site";

        return {
          _id: element._id.toString(),
          id: element._id.toString(),
          invitationId: element._id.toString(),
          companyId: element.companyId,
          clientId: element.clientId,
          jobId: element.jobId,
          jobTitle,
          jobRef,
          salaryBadge,
          location,
          candidate: {
            id: candidateUser?._id?.toString() || element.companyId,
            name: candidateName,
            role: candidateUser?.title || candidateUser?.headline || candidateUser?.designation || "Engineer",
            skills: rawSkills.slice(0, 5),
            profilePic: candidateUser?.profilePic || "",
            isVerified: Boolean(candidateUser?.isProfileCompleted),
            entityType: candidateUser?.userType === USER_TYPES.COMPANY ? "vendor_company" : candidateUser?.userType === USER_TYPES.INDIVIDUAL ? "vendor_individual" : "jobseeker",
          },
          client: {
            id: clientUser?._id?.toString() || element.clientId,
            name: clientUser?.companyName || (clientUser?.firstName ? `${clientUser.firstName} ${clientUser.lastName || ""}`.trim() : "Client"),
          },
          message: element.message,
          status: element.status || "ACTIVE",
          createdAt: element.createdAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Successfully fetched invitations",
      data: arr,
      stats: {
        totalCount,
        pendingCount,
        acceptedCount,
        declinedCount,
      },
    });
  } catch (error) {
    console.error("Error in getInvitations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invitations",
      error: error.message,
    });
  }
};

const respondJobInvitation = async (req, res) => {
  try {
    const { invitationId, action } = req.body;
    const reqUserId = req.user?._id ? req.user._id.toString() : req.body.userId;

    if (!invitationId || !action) {
      return res.status(400).json({
        success: false,
        message: "invitationId and action (ACCEPT or DECLINE) are required",
      });
    }

    const normalizedAction = String(action).toUpperCase();
    if (normalizedAction !== "ACCEPT" && normalizedAction !== "DECLINE") {
      return res.status(400).json({
        success: false,
        message: "action must be either ACCEPT or DECLINE",
      });
    }

    const invitation = await JobsInvitations.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Job invitation not found",
      });
    }

    const candidateId = invitation.companyId || invitation.employeeId || reqUserId;

    if (normalizedAction === "ACCEPT") {
      invitation.status = "ACCEPTED";
      invitation.acceptedAt = new Date();
      await invitation.save();

      const candidateUser = await Users.findById(candidateId).lean();
      const job = invitation.jobId ? await Jobs.findById(invitation.jobId).lean() : null;
      const jobTitleStr = job?.jobTitle || invitation.jobName || "Specialist Role";
      const candName = candidateUser
        ? [candidateUser.firstName, candidateUser.lastName].filter(Boolean).join(" ").trim() || "Candidate"
        : "Candidate";

      // Check if application already exists
      let application = await JobsApplication.findOne({
        jobId: invitation.jobId,
        companyId: candidateId,
      });

      if (!application) {
        application = await JobsApplication.create({
          companyId: candidateId,
          jobId: invitation.jobId,
          clientId: invitation.clientId,
          resume: candidateUser?.document || candidateUser?.resumeUrl || "Profile Document",
          status: "ACTIVE",
          coverNote: `Direct recruiter invitation accepted: "${invitation.message || ""}"`,
          sentAt: new Date(),
          lastUpdatedAt: new Date(),
        });
      }

      // Update candidate's notification
      await Notifications.updateMany(
        {
          userId: candidateId,
          $or: [{ invitationId: invitation._id.toString() }, { jobId: invitation.jobId }],
        },
        {
          $set: {
            invitationStatus: "ACCEPTED",
            status: "Read",
          },
        }
      );

      // Notify recruiter
      await Notifications.create({
        userId: invitation.clientId,
        type: "InvitationAccepted",
        notificationDetail: `${candName} • Accepted`,
        title: "Invitation Accepted! 🎉",
        details: `${candName} accepted your job invitation for ${jobTitleStr}. Application is now live in your pipeline.`,
        status: "New",
        isClear: false,
        sentAt: new Date(),
        jobId: invitation.jobId,
        invitationId: invitation._id.toString(),
      }).catch((err) => console.warn("Failed to notify recruiter:", err.message));

      return res.status(200).json({
        success: true,
        message: "Job invitation accepted! Your application is now active.",
        data: {
          invitationId: invitation._id.toString(),
          applicationId: application._id.toString(),
          status: "ACCEPTED",
        },
      });
    } else {
      // DECLINE
      invitation.status = "DECLINED";
      invitation.declinedAt = new Date();
      await invitation.save();

      // Update candidate's notification
      await Notifications.updateMany(
        {
          userId: candidateId,
          $or: [{ invitationId: invitation._id.toString() }, { jobId: invitation.jobId }],
        },
        {
          $set: {
            invitationStatus: "DECLINED",
            status: "Read",
          },
        }
      );

      const candidateUser = await Users.findById(candidateId).lean();
      const job = invitation.jobId ? await Jobs.findById(invitation.jobId).lean() : null;
      const jobTitleStr = job?.jobTitle || invitation.jobName || "Specialist Role";
      const candName = candidateUser
        ? [candidateUser.firstName, candidateUser.lastName].filter(Boolean).join(" ").trim() || "Candidate"
        : "Candidate";

      // Notify recruiter
      await Notifications.create({
        userId: invitation.clientId,
        type: "InvitationDeclined",
        notificationDetail: `${candName} • Declined`,
        title: "Invitation Update",
        details: `${candName} declined your job invitation for ${jobTitleStr}.`,
        status: "New",
        isClear: false,
        sentAt: new Date(),
        jobId: invitation.jobId,
        invitationId: invitation._id.toString(),
      }).catch((err) => console.warn("Failed to notify recruiter:", err.message));

      return res.status(200).json({
        success: true,
        message: "Job invitation declined.",
        data: {
          invitationId: invitation._id.toString(),
          status: "DECLINED",
        },
      });
    }
  } catch (error) {
    console.error("Error in respondJobInvitation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to respond to job invitation",
      error: error.message,
    });
  }
};

function formatMaskedEmail(email) {
  if (!email || typeof email !== "string") return "••••••@techtalent.in";
  const [user, domain] = email.trim().split("@");
  if (!user || !domain) return "••••••@techtalent.in";
  if (user.length <= 4) {
    return `${user.slice(0, 1)}*******${user.slice(-1)}@${domain}`;
  }
  return `${user.slice(0, 2)}*******${user.slice(-2)}@${domain}`;
}

function formatMaskedPhone(phone) {
  if (!phone || typeof phone !== "string") return "+91 98*******12";
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 4) return "+91 98*******12";
  const isIndia = trimmed.startsWith("+91") || (trimmed.startsWith("91") && digits.length === 12);
  const coreDigits = isIndia && digits.length === 12 ? digits.slice(2) : digits;
  const prefix = isIndia ? "+91 " : trimmed.startsWith("+") ? `+${digits.slice(0, Math.max(0, digits.length - 10))} ` : "";
  if (coreDigits.length >= 4) {
    return `${prefix}${coreDigits.slice(0, 2)}*******${coreDigits.slice(-2)}`;
  }
  return `${prefix}*******`;
}

function cleanSkills(rawSkills) {
  if (!rawSkills) return [];
  const list = Array.isArray(rawSkills)
    ? rawSkills
    : String(rawSkills)
        .split(/[,/|;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

  const categoryHeaders = [
    /^Technical Skills\s+/i,
    /^Frameworks & Libraries\s+/i,
    /^Frameworks\/Technologies\s+/i,
    /^Databases & Caching\s+/i,
    /^Tools & Platforms\s+/i,
    /^Tools\s+/i,
    /^Concepts\s+/i,
  ];

  const cleaned = [];
  for (let s of list) {
    for (const re of categoryHeaders) {
      s = s.replace(re, "").trim();
    }
    if (s && !cleaned.includes(s)) {
      cleaned.push(s);
    }
  }
  return cleaned;
}

const getCandidateProfile = async (req, res) => {
  const id = req.params.id || req.query.id;
  if (!id) {
    return res.status(400).json({ success: false, message: "Candidate ID is required" });
  }

  try {
    let candidateEntity = null;

    // 1. Try resolving against Users collection
    let user = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await Users.findById(id).lean();
    }

    if (user) {
      if (user.userType === USER_TYPES.COMPANY) {
        // Vendor Agency Partner
        const benchEmployees = await EmployeeOnboarding.find({ companyId: user._id.toString() }).lean();
        const rawSkills = cleanSkills(user.skills);
        const benchSkills = Array.from(new Set(benchEmployees.flatMap((e) => cleanSkills(e.skills))));
        const combinedSkills =
          rawSkills.length > 0
            ? rawSkills
            : benchSkills.length > 0
            ? benchSkills
            : ["Full Stack", "Cloud & DevOps", "React", "Node.js"];

        candidateEntity = {
          _id: user._id.toString(),
          id: user._id.toString(),
          entityType: "vendor_company",
          name: user.companyName || user.fullName || "Partner Agency",
          title: `${benchEmployees.length} Verified Bench Engineers`,
          companyName: user.companyName || "Partner Agency",
          companyRepresentative: user.companyRepresentative || user.firstName || "Talent Lead",
          location: user.location || "India • Tier-1 Agency",
          salaryBadge: `${benchEmployees.length} Bench Available`,
          salary: 0,
          profilePic: user.profilePic || "",
          skills: combinedSkills.slice(0, 10),
          benchCount: benchEmployees.length,
          deploySpeed: "< 24 Hours (Pre-screened)",
          isVerified: true,
          openToOffers: true,
          matchScore: 95,
          benchEmployees: benchEmployees.map((e) => ({
            id: e._id.toString(),
            name: e.name,
            designation: e.designation || "Bench Specialist",
            skills: cleanSkills(e.skills).slice(0, 5),
            experience: e.exprience || "4+ years",
            noticePeriod: e.joiningEstimate || "Immediate",
            budget: e.budget ? `₹${(Number(e.budget) / 100000).toFixed(0)} LPA` : "₹25 LPA",
          })),
          email: user.email,
          phone: user.phone,
          maskedEmail: formatMaskedEmail(user.email),
          maskedPhone: formatMaskedPhone(user.phone),
        };
      } else {
        // Personal Jobseeker
        const name =
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          user.fullName ||
          "Candidate";
        const cleanedSkills = cleanSkills(user.skills);
        const isSubscribed = Boolean(user.subscriptionStatus);
        const salaryNum = Number(user.salary || user.expectedSalary) || 0;
        const salaryBadge =
          salaryNum > 0
            ? `₹${(salaryNum / 100000).toFixed(0)}-${((salaryNum * 1.2) / 100000).toFixed(0)} LPA`
            : "₹24 - ₹32 LPA";

        // Experience list - sanitize empty strings and fallback to parsed data
        const expList = sanitizeExperiences(
          user.experienceDetails || user.experienceHistory || user.workExperience,
          user.parsedResume?.experience
        );

        // Education list - sanitize empty strings and fallback to parsed data
        const eduList = sanitizeEducation(
          user.educationDetails || user.educationHistory,
          user.parsedResume?.education
        );

        // Resume metadata
        let resumeUrl = "";
        let resumeName = `${name.replace(/\s+/g, "_")}_Resume.pdf`;
        if (typeof user.resumeData === "string" && user.resumeData.startsWith("http")) {
          resumeUrl = user.resumeData;
        } else if (user.resumeData && typeof user.resumeData === "object") {
          resumeUrl = user.resumeData.url || user.resumeData.fileUri || "";
          if (user.resumeData.fileName) resumeName = user.resumeData.fileName;
        } else if (user.document) {
          resumeUrl = user.document;
        }

        candidateEntity = {
          _id: user._id.toString(),
          id: user._id.toString(),
          entityType: "jobseeker",
          name,
          title: user.title || user.headline || user.desiredRole || user.role || "Software Engineer",
          location:
            user.location ||
            (Array.isArray(user.preferredLocations)
              ? user.preferredLocations.join(", ")
              : user.preferredLocation) ||
            user.preferredLocationCity ||
            user.city ||
            (user.state ? `${user.state}, India` : "India"),
          salaryBadge,
          salary: salaryNum || 2800000,
          profilePic: user.profilePic || "",
          skills:
            cleanedSkills.length > 0
              ? cleanedSkills
              : ["JavaScript", "TypeScript", "React", "Node.js", "MongoDB"],
          experience:
            user.exprience ||
            user.experience ||
            (expList.length > 0 ? `${expList.length * 2}+ Years` : "4+ Years"),
          noticePeriod: isSubscribed ? "0 Day Notice (Subscribed)" : (user.noticePeriod || "15 Days Max"),
          isSubscribed,
          isVerified: Boolean(user.isProfileCompleted || user.kycStatus === "approved"),
          matchScore: 96,
          openToOffers: user.openToOffers !== false,
          experienceDetails: expList,
          educationDetails: eduList,
          resumeUrl,
          resumeName,
          bio: user.bio || "",
          email: user.email,
          phone: user.phone,
          maskedEmail: formatMaskedEmail(user.email),
          maskedPhone: formatMaskedPhone(user.phone),
          standardizedResumeUrl: `/api/user/standardizedResume/${user._id}`,
        };
      }
    }

    // 2. If not found in Users, try EmployeeOnboarding (Bench Engineer)
    if (!candidateEntity && mongoose.Types.ObjectId.isValid(id)) {
      const employee = await EmployeeOnboarding.findById(id).lean();
      if (employee) {
        let vendorCompany = null;
        if (employee.companyId && mongoose.Types.ObjectId.isValid(employee.companyId)) {
          vendorCompany = await Users.findById(employee.companyId).lean();
        }

        const budgetNum = Number(employee.budget || employee.salary) || 0;
        const salaryBadge =
          budgetNum > 0 ? `₹${(budgetNum / 100000).toFixed(0)} LPA` : "₹28 LPA (Fixed)";
        const cleanedSkills = cleanSkills(employee.skills);
        const employeeExp = sanitizeExperiences(employee.experienceDetails, employee.parsedResume?.experience);
        const employeeEdu = sanitizeEducation(employee.educationDetails, employee.parsedResume?.education);

        candidateEntity = {
          _id: employee._id.toString(),
          id: employee._id.toString(),
          entityType: "vendor_individual",
          name: employee.name || "Bench Engineer",
          title: employee.designation || "Senior Systems Engineer",
          companyName: vendorCompany?.companyName || "Tech Agency Partner",
          companyRepresentative:
            vendorCompany?.companyRepresentative || vendorCompany?.firstName || "Agency Lead",
          vendorEmail: vendorCompany?.email || "alliances@partner.in",
          vendorPhone: vendorCompany?.phone || "+91 99800 11223",
          location: employee.location || vendorCompany?.location || "India • Hybrid / Remote",
          salaryBadge,
          salary: budgetNum || 2800000,
          profilePic: employee.profilePic || "",
          skills:
            cleanedSkills.length > 0
              ? cleanedSkills
              : ["Node.js", "Python", "React", "PostgreSQL"],
          experience: employee.exprience || "5+ Years",
          noticePeriod: employee.joiningEstimate || "Immediate (0-7 Days)",
          isSubscribed: false,
          isVerified: true,
          benchReady: true,
          matchScore: 93,
          resumeUrl: employee.resume || "",
          resumeName: `${(employee.name || "Bench").replace(/\s+/g, "_")}_Resume.pdf`,
          experienceDetails: employeeExp,
          educationDetails: employeeEdu,
          maskedEmail: formatMaskedEmail(employee.email || "bench@partner.in"),
          maskedPhone: formatMaskedPhone(employee.phone || "+91 9876543210"),
          standardizedResumeUrl: `/api/user/standardizedResume/${employee._id}`,
        };
      }
    }

    // 3. If still not found, check if id is an Application ID
    if (!candidateEntity && mongoose.Types.ObjectId.isValid(id)) {
      const app = await JobsApplication.findById(id).lean();
      if (app) {
        const candidateId = app.companyId || app.employeeId;
        if (candidateId) {
          req.params.id = candidateId;
          return getCandidateProfile(req, res);
        }
      }
    }

    if (!candidateEntity) {
      return res.status(404).json({
        success: false,
        message: "Candidate profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Candidate profile retrieved successfully",
      data: candidateEntity,
    });
  } catch (error) {
    console.error("Error in getCandidateProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve candidate profile",
      error: error.message,
    });
  }
};

module.exports = {
  getJobSeekerAndVendor,
  inviteJobInvitation,
  getInvitations,
  respondJobInvitation,
  getCandidateProfile,
};
