const Notifications = require("../models/notificatonModel");
const JobsApplications = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const Users = require("../models/userModel");
const JobsInvitations = require("../models/invitationModel");
const JobsInterview = require("../models/mettingModel");

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const matchesSkill = (skillA, skillB) => {
  const a = String(skillA || "").toLowerCase().trim();
  const b = String(skillB || "").toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  // Disambiguate java vs javascript
  if ((a === "java" && b.includes("javascript")) || (b === "java" && a.includes("javascript"))) {
    return false;
  }
  // Disambiguate c vs c++ vs c#
  if ((a === "c" && (b === "c++" || b === "c#")) || (b === "c" && (a === "c++" || a === "c#"))) {
    return false;
  }
  if (a.length > 2 && b.length > 2) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
  }
  return false;
};

/**
 * Helper: Format location into clean city/state string
 */
function formatLocation(loc) {
  if (!loc) return "Remote";
  if (typeof loc === "object") {
    return [loc.city, loc.state].filter(Boolean).join(", ") || "India";
  }
  if (typeof loc === "string" && loc.startsWith("{")) {
    try {
      const parsed = JSON.parse(loc);
      return [parsed.city, parsed.state].filter(Boolean).join(", ") || "India";
    } catch {
      return loc;
    }
  }
  return String(loc);
}

/**
 * Helper: Format salary/budget numbers into human LPA string
 * Handles: raw paise (1800000 → ₹18 LPA), already-LPA strings, small integers (18 → ₹18 LPA)
 */
function formatSalary(val) {
  if (!val) return "";
  if (typeof val === "string" && /lpa/i.test(val)) return val.trim();
  const num = Number(val);
  if (!isNaN(num)) {
    // Stored as full rupees (>= 100000 means raw rupees, divide by 100000 to get LPA)
    if (num >= 100000) return `₹${Math.round(num / 100000)} LPA`;
    // Stored as LPA directly (e.g. 18, 24, 40)
    if (num > 0) return `₹${num} LPA`;
  }
  return `₹${val}`;
}

/**
 * Helper: Resolve a human-friendly tag if notificationDetail is a raw 24-char ObjectId or empty
 */
function resolveTag(n) {
  const detail = (n.notificationDetail || "").trim();
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(detail);
  if (!isObjectId && detail.length > 0) {
    return formatLocation(detail);
  }

  const type = String(n.type || "").toUpperCase();
  const text = `${n.title || ""} ${n.details || ""}`.toLowerCase();

  if (type === "INTERVIEW" || text.includes("interview") || text.includes("meet")) {
    return "Google Meet";
  }
  if (type === "APPLICATION_ONBOARDED" || text.includes("onboarded")) {
    return "Offer Signed";
  }
  if (text.includes("accepted")) {
    return "Accepted";
  }
  if (text.includes("applied for") || text.includes("new application")) {
    return "New Applicant";
  }
  if (type === "JOBINVITATION" || text.includes("invitation")) {
    return "Direct Invite";
  }
  if (type.startsWith("KYC") || text.includes("kyc")) {
    return "Verified Recruiter";
  }
  if (type === "JOBALERT" || text.includes("match")) {
    return "High Match";
  }
  return "Verified Alert";
}

/**
 * Synchronize real backend activity into Notifications collection for the user.
 * Pulls from real JobsApplications, JobsInterview, JobsInvitations, Jobs, and Users.
 */
async function syncRealUserNotifications(userId, userType) {
  if (!userId) return;

  try {
    const isClient = userType === "client";

    if (isClient) {
      // ─────────────────────────────────────────────
      // 1. CLIENT / EMPLOYER REAL ACTIVITY SYNC
      // ─────────────────────────────────────────────
      const clientUser = await Users.findById(userId).catch(() => null);

      // Find jobs posted by this client or associated by companyId/clientId
      let clientJobs = await Jobs.find({
        $or: [{ companyId: userId }, { clientId: userId }],
      }).catch(() => []);

      let jobIds = clientJobs.map((j) => j._id.toString());

      // If no explicit job matches found, search by employer company name
      if (jobIds.length === 0 && clientUser) {
        const queryTerm = clientUser.firstName || clientUser.lastName;
        if (queryTerm) {
          const matchingJobs = await Jobs.find({
            companyName: new RegExp(queryTerm, "i"),
          }).limit(10).catch(() => []);
          clientJobs = matchingJobs;
          jobIds = matchingJobs.map((j) => j._id.toString());
        }
      }

      // Find real applications submitted for these jobs
      const clientApps = await JobsApplications.find({
        $or: [{ clientId: userId }, { jobId: { $in: jobIds } }],
      })
        .sort({ sentAt: -1 })
        .limit(15)
        .catch(() => []);

      for (const app of clientApps) {
        const appId = app._id.toString();
        const applicantName = app.screeningAnswers?.fullName || "Candidate";
        const job =
          clientJobs.find((j) => j._id.toString() === String(app.jobId)) ||
          (await Jobs.findById(app.jobId).catch(() => null));

        const expectedDetails = `${applicantName} applied for ${job?.jobTitle || "your job opening"}`;

        // Deduplicate by content match (since we store readable tag not raw appId)
        const existing = await Notifications.findOne({
          userId: userId,
          details: expectedDetails,
        }).catch(() => null);

        if (!existing) {
          const rawLocation = app.screeningAnswers?.location || job?.jobLocation || "India";
          const location = formatLocation(rawLocation);
          const salaryStr = job?.budget ? formatSalary(job.budget) : "";
          const tag = salaryStr ? `${location} • ${salaryStr}` : `${location} • Direct Applicant`;

          await Notifications.create({
            userId: userId,
            type: "JobApplication",
            notificationDetail: tag,
            title: "New application received",
            details: expectedDetails,
            status: "New",
            isClear: false,
            sentAt: app.sentAt || new Date(),
          }).catch((err) => console.warn("Notif create app err:", err.message));
        }
      }

      // Sync real interviews
      const meets = await JobsInterview.find({
        clientId: userId,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .catch(() => []);

      for (const meet of meets) {
        const meetId = meet._id.toString();
        const existing = await Notifications.findOne({
          userId: userId,
          notificationDetail: meetId,
        }).catch(() => null);

        if (!existing) {
          const isZoom = (meet.meetingLink || meet.joinUrl || "").includes("zoom") || meet.meetingPlatform === "zoom";
          await Notifications.create({
            userId: userId,
            type: "Interview",
            notificationDetail: meetId,
            title: `Interview ${meet.status || "Scheduled"}`,
            details: `Interview with ${meet.candidate || "candidate"} for ${meet.jobTitle || "opening"} at ${meet.meetingStartTime}. Platform: ${isZoom ? "Zoom" : "Google Meet"}`,
            status: "New",
            isClear: false,
            sentAt: meet.createdAt || new Date(),
          }).catch(() => null);
        }
      }

      // Sync real client KYC status
      if (clientUser && clientUser.document) {
        const kycNotif = await Notifications.findOne({
          userId: userId,
          type: "KYC_CLIENT",
        }).catch(() => null);

        if (!kycNotif) {
          const isApproved = String(clientUser.kycStatus || "").toLowerCase() === "approved";
          await Notifications.create({
            userId: userId,
            type: "KYC_CLIENT",
            notificationDetail: "Verified Recruiter Signal",
            title: isApproved ? "Account update: KYC Approved" : "Account update: KYC In Progress",
            details: isApproved
              ? "Company GST and PAN Verification successfully verified (KYC Approved)"
              : "Your business documents have been received and are currently under verification",
            status: "Read",
            isClear: false,
            sentAt: clientUser.updatedAt || new Date(),
          }).catch(() => null);
        }
      }
    } else {
      // ─────────────────────────────────────────────
      // 2. CANDIDATE / JOBSEEKER REAL ACTIVITY SYNC
      // ─────────────────────────────────────────────
      // Find all real applications submitted by this candidate
      const candidateApps = await JobsApplications.find({
        companyId: userId,
      })
        .sort({ sentAt: -1 })
        .limit(10)
        .catch(() => []);

      for (const app of candidateApps) {
        const job = await Jobs.findById(app.jobId).catch(() => null);
        const compName = job?.companyName || "Employer";
        const jobTitle = job?.jobTitle || "opening";
        const status = String(app.status || "").toUpperCase();

        let title = "Application Submitted";
        let details = `Your application for ${jobTitle} at ${compName} has been received and is under review.`;
        let tag = `${compName} • Submitted`;

        if (status === "ONBOARDED") {
          title = "Application Onboarded 🎉";
          details = `Congratulations! You have been onboarded for ${jobTitle} at ${compName}.`;
          tag = `${compName} • Onboarded`;
        } else if (status === "ACCEPTED") {
          title = "Application Accepted 🎉";
          details = `Great news! Your application for ${jobTitle} at ${compName} has been accepted. Recruiter will contact you for further steps.`;
          tag = `${compName} • Accepted`;
        } else if (status === "REJECTED") {
          title = "Application Update";
          details = `Your application for ${jobTitle} at ${compName} was not moved to the next round.`;
          tag = `${compName} • Not Selected`;
        } else if (status === "WITHDRAWN") {
          title = "Application Withdrawn";
          details = `You withdrew your application for ${jobTitle} at ${compName}.`;
          tag = `${compName} • Withdrawn`;
        }

        // Deduplicate by title+details match to avoid duplication on repeated fetches
        const existing = await Notifications.findOne({
          userId: userId,
          title: title,
          details: details,
        }).catch(() => null);

        if (!existing) {
          await Notifications.create({
            userId: userId,
            type: "JobApplication",
            notificationDetail: tag,
            title: title,
            details: details,
            status: "New",
            isClear: false,
            sentAt: app.lastUpdatedAt || app.sentAt || new Date(),
          }).catch((err) => console.warn("Notif create candidate err:", err.message));
        }
      }

      // Sync real job invitations
      const invitations = await JobsInvitations.find({
        $or: [{ employeeId: userId }, { companyId: userId }],
      })
        .sort({ sentAt: -1 })
        .limit(5)
        .catch(() => []);

      for (const inv of invitations) {
        const invId = inv._id.toString();
        const existing = await Notifications.findOne({
          userId: userId,
          notificationDetail: invId,
        }).catch(() => null);

        if (!existing) {
          const job = await Jobs.findById(inv.jobId).catch(() => null);
          await Notifications.create({
            userId: userId,
            type: "JobInvitation",
            notificationDetail: `${job?.companyName || "Employer"} • Invitation`,
            title: "Job Invitation Received",
            details: `You received an invitation to interview for ${job?.jobTitle || "a new role"} at ${job?.companyName || "company"}.`,
            status: "New",
            isClear: false,
            sentAt: inv.sentAt || new Date(),
          }).catch(() => null);
        }
      }

      // Sync real candidate interviews
      const meets = await JobsInterview.find({
        employeeId: userId,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .catch(() => []);

      for (const meet of meets) {
        const meetId = meet._id.toString();
        const existing = await Notifications.findOne({
          userId: userId,
          notificationDetail: meetId,
        }).catch(() => null);

        if (!existing) {
          const isZoom = (meet.meetingLink || meet.joinUrl || "").includes("zoom") || meet.meetingPlatform === "zoom";
          await Notifications.create({
            userId: userId,
            type: "Interview",
            notificationDetail: meetId,
            title: "Interview Scheduled",
            details: `Interview for ${meet.jobTitle || "your application"} scheduled for ${meet.meetingStartTime}. Platform: ${isZoom ? "Zoom" : "Google Meet"}`,
            status: "New",
            isClear: false,
            sentAt: meet.createdAt || new Date(),
          }).catch(() => null);
        }
      }

      // 4. CANDIDATE PROFILE SKILL-MATCHED REAL JOB ALERTS
      const candidateUser = await Users.findById(userId).select("skills").catch(() => null);
      const candSkillTokens = String(candidateUser?.skills || "")
        .split(/[,/|;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      // Find active jobs posted to the platform
      const activeJobs = await Jobs.find({ status: { $ne: "INACTIVE" } })
        .sort({ _id: -1 })
        .limit(25)
        .catch(() => []);

      for (const j of activeJobs) {
        const jId = j._id.toString();
        // Check if user already has an alert for this job
        const existing = await Notifications.findOne({
          userId: userId,
          $or: [
            { jobId: jId },
            { notificationDetail: jId },
            { title: `New Job Match: ${j.jobTitle}` },
          ],
        }).catch(() => null);

        if (!existing) {
          const rawSkills = String(j.requiredSkills || "");
          const jobSkills = rawSkills
            .split(/[,/|]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 1);

          const matched = [];
          if (candSkillTokens.length > 0 && jobSkills.length > 0) {
            for (const js of jobSkills) {
              if (candSkillTokens.some((cs) => matchesSkill(cs, js))) {
                matched.push(js);
              }
            }
          }

          // If skills match, create an instant skill match notification
          if (matched.length > 0) {
            const loc = formatLocation(j.jobLocation);
            const comp = j.companyName || j.displayCompanyName || "Employer";
            const matchedStr = matched.slice(0, 3).join(", ");

            await Notifications.create({
              userId: userId,
              type: "JobAlert",
              notificationDetail: `${comp} • ${loc}`,
              title: `New Job Match: ${j.jobTitle}`,
              details: `Posted recently at ${comp}. Matches your profile skill${matched.length > 1 ? "s" : ""} (${matchedStr}).`,
              status: "New",
              isClear: false,
              sentAt: j.createdAt || new Date(),
              jobId: jId,
            }).catch(() => null);
          }
        }
      }

      // Fallback: If candidate has < 2 total notifications, provide general job alert
      const currentCount = await Notifications.countDocuments({
        userId: userId,
        status: { $ne: "Delete" },
        isClear: false,
      }).catch(() => 0);

      if (currentCount < 2 && activeJobs.length > 0) {
        for (const j of activeJobs.slice(0, 2)) {
          const jId = j._id.toString();
          const existing = await Notifications.findOne({
            userId: userId,
            $or: [{ jobId: jId }, { notificationDetail: jId }],
          }).catch(() => null);

          if (!existing) {
            const loc = formatLocation(j.jobLocation);
            const sal = j.budget ? formatSalary(j.budget) : "Competitive";
            const comp = j.companyName || "Employer";
            await Notifications.create({
              userId: userId,
              type: "JobAlert",
              notificationDetail: `${comp} • ${loc}`,
              title: `Job Alert: ${j.jobTitle}`,
              details: `${comp} is hiring for ${j.jobTitle} in ${loc} (${sal}).`,
              status: "Read",
              isClear: false,
              sentAt: j.createdAt || new Date(),
              jobId: jId,
            }).catch(() => null);
          }
        }
      }
    }
  } catch (syncErr) {
    console.warn("syncRealUserNotifications error:", syncErr);
  }
}

const getNotification = async (req, res) => {
  const userId = req.query.userId || (req.user && req.user._id ? req.user._id.toString() : null);
  const userType = req.query.userType || (req.user && req.user.userType ? req.user.userType : "personal");
  const category = (req.query.category || "").toLowerCase();

  try {
    // 1. Sync any new real platform activity into Notifications collection
    if (userId && userType !== "admin") {
      await syncRealUserNotifications(userId, userType);
    }

    // 2. Query active notifications from MongoDB
    let baseQuery = {
      status: { $ne: "Delete" },
      isClear: false,
    };

    if (userType === "admin") {
      baseQuery.type = {
        $in: ["KYC_COMPANY", "KYC_INDIVIDUAL", "KYC_CLIENT", "APPLICATION_ONBOARDED", "all"],
      };
    } else if (userId) {
      baseQuery.userId = userId;
    }

    let notifications = await Notifications.find(baseQuery).sort({ sentAt: -1, _id: -1 }).lean();

    // 3. Resolve any raw 24-character ObjectIds in notificationDetail into semantic clean tags
    if (Array.isArray(notifications)) {
      notifications = notifications.map((n) => ({
        ...n,
        notificationDetail: resolveTag(n),
      }));
    }

    // 4. Server-side category filtering
    if (category && category !== "all" && Array.isArray(notifications)) {
      if (category === "interviews") {
        notifications = notifications.filter(
          (n) =>
            /interview/i.test(n.type || "") ||
            /interview|meet|zoom|round|prep|reschedule/i.test(n.title || "") ||
            /interview|meet|zoom|portfolio review/i.test(n.details || "")
        );
      } else if (category === "applications") {
        notifications = notifications.filter(
          (n) =>
            /application/i.test(n.type || "") ||
            /application|status|review|shortlist|deliver|onboard/i.test(n.title || "") ||
            /application|viewed your|delivered to/i.test(n.details || "")
        );
      } else if (category === "jobs" || category === "job alerts") {
        notifications = notifications.filter(
          (n) =>
            /job|match|invitation|alert/i.test(n.type || "") ||
            /match|deadline|invitation|alert|role/i.test(n.title || "") ||
            /match|posted|close in|preferences/i.test(n.details || "")
        );
      } else if (category === "applicants") {
        notifications = notifications.filter(
          (n) =>
            /application|applicant/i.test(n.type || "") ||
            /application|applicant|applied|resume/i.test(n.title || "") ||
            /applied for|uploaded/i.test(n.details || "")
        );
      } else if (category === "system" || category === "kyc") {
        notifications = notifications.filter(
          (n) =>
            /kyc|system|account|onboarded/i.test(n.type || "") ||
            /kyc|account|onboarded|verification/i.test(n.title || "") ||
            /gst|pan|verified|approved/i.test(n.details || "")
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Successfully Fetched",
      data: notifications || [],
    });
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const getNotificationUnreadCount = async (req, res) => {
  const userId = req.query.userId || (req.user && req.user._id ? req.user._id.toString() : null);

  try {
    if (!userId) {
      return res.status(200).json({ success: true, data: 0 });
    }
    const count = await Notifications.countDocuments({
      userId: userId,
      status: "New",
      isClear: false,
    });
    return res.status(200).json({
      success: true,
      message: "Successfully Fetched",
      data: count,
    });
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const deleteNotification = async (req, res) => {
  const notificationId = req.body.notificationId || req.query.notificationId;
  try {
    if (!notificationId) {
      return res.status(400).json({ success: false, message: "notificationId is required" });
    }
    const notification = await Notifications.findOne({ _id: notificationId });
    if (notification) {
      notification.status = "Delete";
      await notification.save();
      return res.status(200).json({
        success: true,
        message: "Successfully Deleted",
      });
    } else {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const updateNotification = async (req, res) => {
  const notificationId = req.body.notificationId;
  const userId = req.body.userId || req.query.userId || (req.user && req.user._id ? req.user._id.toString() : null);
  const markAll = req.body.all === true || req.body.markAllRead === true || notificationId === "all";

  try {
    // Bulk mark all as read for user
    if (markAll && userId) {
      await Notifications.updateMany(
        { userId: userId, status: "New", isClear: false },
        { $set: { status: "Read" } }
      );
      return res.status(200).json({
        success: true,
        message: "Successfully Marked All as Read",
      });
    }

    if (!notificationId) {
      return res.status(400).json({ success: false, message: "notificationId is required" });
    }

    const notification = await Notifications.findOne({ _id: notificationId });
    if (notification) {
      notification.status = "Read";
      await notification.save();
      return res.status(200).json({
        success: true,
        message: "Successfully Updated",
      });
    } else {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const clearNotification = async (req, res) => {
  const userId = req.query.userId || req.body.userId || (req.user && req.user._id ? req.user._id.toString() : null);
  const userType = req.query.userType || req.body.userType || (req.user && req.user.userType ? req.user.userType : "personal");

  try {
    if (!userId && userType !== "admin") {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    let result;
    if (userType === "admin") {
      result = await Notifications.updateMany(
        { type: { $in: ["KYC_COMPANY", "KYC_INDIVIDUAL", "KYC_CLIENT", "APPLICATION_ONBOARDED"] } },
        { $set: { isClear: true } }
      );
    } else {
      result = await Notifications.updateMany(
        { userId: userId },
        { $set: { isClear: true } }
      );
    }
    if (result) {
      return res.status(200).json({
        success: true,
        message: "Successfully Cleared Notification",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

module.exports = {
  getNotification,
  getNotificationUnreadCount,
  deleteNotification,
  updateNotification,
  clearNotification,
};
