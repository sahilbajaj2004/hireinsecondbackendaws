const { USER_TYPES, PHASE_A_COMPANY_NAME } = require("../constants/constants");
const mongoose = require("mongoose");
const JobsApplications = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const SavedJobs = require("../models/savedJobs");
const Users = require("../models/userModel");
const Notifications = require("../models/notificatonModel");
const { getJobslist } = require("./jobsApplicationsController");

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
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

function formatLocation(loc) {
  if (!loc) return "India";
  if (typeof loc === "object") {
    const parts = [loc.city, loc.state, loc.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "India";
  }
  const str = String(loc).trim();
  if (str.includes("{") && str.includes("}")) {
    try {
      const match = str.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed === "object" && parsed !== null) {
          const parts = [parsed.city, parsed.state, parsed.country].filter(Boolean);
          const cleanLoc = parts.length > 0 ? parts.join(", ") : "India";
          const replaced = str.replace(match[0], cleanLoc).replace(/\s+/g, " ").trim();
          return replaced || "India";
        }
      }
    } catch {
      return str;
    }
  }
  return str || "India";
}

/**
 * Dispatch real-time JobAlert notifications to active candidates whose profile skills
 * match the newly posted job requirements.
 */
const notifyMatchingCandidatesForNewJob = async (job) => {
  try {
    if (!job || !job._id) return;
    const rawSkills = String(job.requiredSkills || "");
    const jobSkills = rawSkills
      .split(/[,/|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);

    if (jobSkills.length === 0) return;

    // Find all active personal/jobseeker users who have profile skills
    const candidates = await Users.find({
      userType: USER_TYPES.PERSONAL,
      status: true,
      skills: { $exists: true, $ne: "" },
    }).select("_id skills email firstName");

    if (!candidates || candidates.length === 0) return;

    const notifBatch = [];
    const jobCompany = job.companyName || job.displayCompanyName || "Employer";
    const jobTitle = job.jobTitle || "New Role";
    const loc = formatLocation(job.jobLocation);

    for (const candidate of candidates) {
      const candSkillTokens = String(candidate.skills || "")
        .split(/[,/|;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (candSkillTokens.length === 0) continue;

      // Check which required skills are matched in candidate profile
      const matched = [];
      for (const js of jobSkills) {
        if (candSkillTokens.some((cs) => matchesSkill(cs, js))) {
          matched.push(js);
        }
      }

      if (matched.length > 0) {
        const matchedStr = matched.slice(0, 3).join(", ");
        notifBatch.push({
          userId: candidate._id.toString(),
          type: "JobAlert",
          notificationDetail: `${jobCompany} • ${loc}`,
          title: `New Job Match: ${jobTitle}`,
          details: `Posted just now at ${jobCompany}. Matches your profile skill${matched.length > 1 ? "s" : ""} (${matchedStr}).`,
          status: "New",
          isClear: false,
          sentAt: new Date(),
          jobId: job._id.toString(),
        });
      }
    }

    if (notifBatch.length > 0) {
      await Notifications.insertMany(notifBatch, { ordered: false }).catch((err) => {
        console.warn("[notifyMatchingCandidatesForNewJob] partial insert warning:", err.message);
      });
      console.log(`[Job Alert] Notified ${notifBatch.length} matching candidates for job: "${jobTitle}"`);
    }
  } catch (err) {
    console.error("[notifyMatchingCandidatesForNewJob] error:", err);
  }
};

const addJobs = async (req, res) => {
  try {
    const {
      companyId,
      jobTitle,
      jobDescription,
      jobLocation,
      positions,
      functionalArea,
      requiredSkills,
      qualification,
      noticePeriod,
      budget,
      isBudgetDisclosed,
      jobType,
      experience,
      paymentType,
      currency,
      probabation,
      paymentTerms,
      taxTerms,
      selectionType,
      applicationType,
      country,
      contractDays,
      replacementDays,
      companyName,
      profilePic
    } = req.body;
    const updateJobs = await Jobs.create({
      companyId,
      jobTitle,
      jobDescription,
      jobLocation,
      positions,
      functionalArea,
      requiredSkills,
      qualification,
      noticePeriod,
      budget,
      isBudgetDisclosed,
      jobType,
      experience,
      paymentType,
      currency,
      probabation,
      paymentTerms,
      taxTerms,
      selectionType,
      applicationType,
      country,
      contractDays,
      replacementDays,
      companyName,
      profilePic,
      displayCompanyName: selectionType === "phaseB" ? companyName : PHASE_A_COMPANY_NAME,
    });
    // const userObj = await Users.findOne({ _id: new mongoose.Types.ObjectId(companyId) });
    if (updateJobs) {
      let response = {};
      const data = await Jobs.findOne({ _id: updateJobs._id });
      
      const parseBudgetValue = (val) => {
        if (!val) return 0;
        if (typeof val === "number") return val;
        const matches = String(val).match(/\d+(\.\d+)?/g);
        if (!matches || matches.length === 0) return 0;
        if (matches.length >= 2) {
          return (Number(matches[0]) + Number(matches[1])) / 2;
        }
        return Number(matches[0]);
      };

      let numericBudget = parseBudgetValue(budget);
      if (numericBudget > 0 && numericBudget <= 100) {
        // Normalize single LPA input (e.g. 24 -> 2400000)
        numericBudget = numericBudget * 100000;
      }
      let commission = 0;
      if (selectionType === "phaseB") {
        const percentage = Number(paymentTerms) || 8.33;
        commission = (numericBudget * percentage) / 100;
      }
      data.commission = Number.isFinite(commission) ? Number(commission.toFixed(2)) : 0;
      data.salary = Number.isFinite(numericBudget) ? numericBudget : 0;
      await data.save();

      // Dispatch real-time skill-matched notifications to candidate jobseekers
      notifyMatchingCandidatesForNewJob(data || updateJobs).catch((err) => {
        console.error("Error dispatching matching candidate notifications:", err);
      });

      res.status(200).json({
        success: true,
        message: "Jobs added successfully",
        data: data || updateJobs,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Jobs not added successfully",
      });
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};
const getSavedJobsStatus = async (jobId, userId) => {
  if (!userId || !jobId) return false;
  const savedJob = await SavedJobs.exists({
    userId: String(userId),
    jobId: String(jobId),
    isSaved: true,
  });
  return Boolean(savedJob);
};

const getIsAppliedStatus = async (jobId, userId) => {
  if (!userId || !jobId) return false;
  const appliedJob = await JobsApplications.findOne({
    companyId: userId,
    jobId: jobId,
  });
  return Boolean(appliedJob && appliedJob.status !== "REJECTED");
};
const getJobs = async (req, res) => {
  try {
    const { userId, pageId = 1, pageSize = 10, filters = {} } = req.query;
    const limit = parseInt(pageSize);
    const skip = (parseInt(pageId) - 1) * limit;

    let query = {
      $expr: { $gt: [{ $toInt: "$positions" }, 0] },
    };

    // Status filter (defaults to ACTIVE if not provided)
    // Use "ALL" to return jobs of all statuses
    const statusFilter = filters.status || "ACTIVE";
    if (statusFilter !== "ALL") {
      query.status = statusFilter;
    }

    let isClient = false;
    // If userId is provided, check if it's a client user
    if (userId) {
      const user = await Users.findById(userId);
      if (user && user.userType === USER_TYPES.CLIENT) {
        // Client users can only see their own jobs
        query.companyId = userId;
        isClient = true;
      }
    }

    const andConditions = [];

    // Keyword Search
    if (filters.keyword) {
      const keywordRegex = new RegExp(escapeRegex(filters.keyword), "i");
      let companySearchCondition;

      if (isClient) {
        companySearchCondition = { companyName: keywordRegex };
      } else {
        companySearchCondition = {
          $or: [
            {
              $and: [
                { selectionType: "phaseA" },
                { displayCompanyName: keywordRegex },
              ],
            },
            {
              $and: [
                { selectionType: { $ne: "phaseA" } },
                { companyName: keywordRegex },
              ],
            },
          ],
        };
      }

      let orConditions = [
        { jobTitle: keywordRegex },
        { functionalArea: keywordRegex },
        { requiredSkills: keywordRegex },
        { jobLocation: keywordRegex },
        { jobDescription: keywordRegex },
        companySearchCondition,
      ];
      if (mongoose.Types.ObjectId.isValid(filters.keyword)) {
        orConditions.push({ _id: filters.keyword });
      }
      andConditions.push({ $or: orConditions });
    }

    // Category / Functional Area (Engineering, Design, Product, Marketing, Sales, etc.)
    const categoryParam = filters.category || filters.functionalArea;
    if (categoryParam) {
      const categoryList = (Array.isArray(categoryParam) ? categoryParam : String(categoryParam).split(","))
        .map((c) => c.trim())
        .filter(Boolean);

      if (categoryList.length > 0) {
        const categoryConditions = [];
        for (const cat of categoryList) {
          const catRegex = new RegExp(escapeRegex(cat), "i");
          const lowerCat = cat.toLowerCase();

          if (lowerCat.includes("engineer") || lowerCat.includes("tech") || lowerCat.includes("dev")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(developer|engineer|software|frontend|backend|full\s*stack|devops|mobile|ios|android|qa|architect|programmer|coder|sre|data\s*engineer)/i },
              { requiredSkills: /(react|node|javascript|typescript|python|java|c\+\+|golang|aws|cloud|sql|mongodb)/i }
            );
          } else if (lowerCat.includes("design") || lowerCat.includes("ui") || lowerCat.includes("ux")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(designer|ui|ux|visual|graphic|product\s*designer|illustrator|animator)/i },
              { requiredSkills: /(figma|adobe|photoshop|illustrator|sketch|ui\/ux|wireframing|prototyping)/i }
            );
          } else if (lowerCat.includes("product")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(product\s*manager|product\s*owner|product\s*lead|associate\s*product\s*manager|product\s*analyst|program\s*manager)/i }
            );
          } else if (lowerCat.includes("market") || lowerCat.includes("growth")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(marketing|growth|seo|content|social\s*media|campaign|brand|copywriter)/i },
              { requiredSkills: /(seo|sem|content|social\s*media|google\s*analytics|campaign|copywriting)/i }
            );
          } else if (lowerCat.includes("sale") || lowerCat.includes("business dev") || lowerCat.includes("revenue")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(sales|bdr|sdr|business\s*development|account\s*executive|account\s*manager|revenue)/i }
            );
          } else {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: catRegex },
              { requiredSkills: catRegex }
            );
          }
        }
        if (categoryConditions.length > 0) {
          andConditions.push({ $or: categoryConditions });
        }
      }
    }

    // Location (supports string, array, or object)
    if (filters.location) {
      if (typeof filters.location === "string") {
        const locRegex = new RegExp(escapeRegex(filters.location.trim()), "i");
        andConditions.push({
          $or: [
            { jobLocation: locRegex },
            { country: locRegex },
          ],
        });
      } else {
        const { countries, states, cities } = filters.location;
        if (countries) {
          const countryList = countries
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
          if (countryList.length > 0) {
            query.country = { $in: countryList.map((c) => new RegExp(escapeRegex(c), "i")) };
          }
        }
        let locations = [];
        if (states) locations.push(...states.split(",").map((s) => s.trim()));
        if (cities) locations.push(...cities.split(",").map((s) => s.trim()));
        locations = locations.filter((s) => s);

        if (locations.length > 0) {
          query.jobLocation = { $in: locations.map((l) => new RegExp(escapeRegex(l), "i")) };
        }
      }
    }

    // Skills (supports array or comma-separated string)
    if (filters.skills) {
      const skillsList = (Array.isArray(filters.skills) ? filters.skills : String(filters.skills).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (skillsList.length > 0) {
        query.requiredSkills = {
          $in: skillsList.map((s) => new RegExp(escapeRegex(s), "i")),
        };
      }
    }

    // Job Types (supports array or comma-separated string)
    const rawJobTypes = filters.jobTypes || filters.jobType;
    if (rawJobTypes) {
      const typesList = (Array.isArray(rawJobTypes) ? rawJobTypes : String(rawJobTypes).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (typesList.length > 0) {
        query.jobType = { $in: typesList.map((t) => new RegExp(escapeRegex(t), "i")) };
      }
    }

    // Experience (supports array or comma-separated string)
    const rawExp = filters.requiredExperience || filters.experience;
    if (rawExp) {
      const expList = (Array.isArray(rawExp) ? rawExp : String(rawExp).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (expList.length > 0) {
        query.experience = { $in: expList.map((e) => new RegExp(escapeRegex(e), "i")) };
      }
    }

    // Work Mode (supports array or comma-separated string)
    if (filters.workMode) {
      const modeList = (Array.isArray(filters.workMode) ? filters.workMode : String(filters.workMode).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (modeList.length > 0) {
        query.applicationType = {
          $in: modeList.map((m) => new RegExp(escapeRegex(m), "i")),
        };
      }
    }

    // Qualifications (supports array or comma-separated string)
    if (filters.qualification) {
      const quaList = (Array.isArray(filters.qualification) ? filters.qualification : String(filters.qualification).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (quaList.length > 0) {
        query.qualification = { $in: quaList.map((q) => new RegExp(escapeRegex(q), "i")) };
      }
    }

    // Salary Filters (min and max)
    const minSalary = Number(filters.salaryMin || filters.minSalary);
    if (!isNaN(minSalary) && minSalary > 0) {
      query.salary = { ...(query.salary || {}), $gte: minSalary };
    }
    const maxSalary = Number(filters.salaryMax || filters.maxSalary);
    if (!isNaN(maxSalary) && maxSalary > 0) {
      query.salary = { ...(query.salary || {}), $lte: maxSalary };
    }

    // Freshness (supports "last Ndays", "24h", "3 days", "7 days", "30 days")
    const rawFreshness = filters.freshness || filters.postedWithin;
    if (rawFreshness) {
      let days = 0;
      const match = String(rawFreshness).match(/last (\d+)days/i);
      if (match) {
        days = parseInt(match[1]);
      } else if (/24h|1\s*day/i.test(rawFreshness)) {
        days = 1;
      } else if (/3\s*days/i.test(rawFreshness)) {
        days = 3;
      } else if (/7\s*days|week/i.test(rawFreshness)) {
        days = 7;
      } else if (/14\s*days/i.test(rawFreshness)) {
        days = 14;
      } else if (/30\s*days|month/i.test(rawFreshness)) {
        days = 30;
      }
      if (days > 0) {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        query.createdAt = { $gte: dateFrom };
      }
    }

    // Application Freshness
    if (filters.applicationFreshness) {
      const freshness = filters.applicationFreshness.toLowerCase();
      let dateFrom;

      if (freshness === "last hour") {
        dateFrom = new Date(Date.now() - 60 * 60 * 1000);
      } else if (freshness === "today") {
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
      } else if (freshness === "this week") {
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (freshness === "last 30 days") {
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      let condition = { $exists: true }; // checks if lastApplicationAt key exists
      if (dateFrom) {
        condition.$gte = dateFrom;
      }
      query.lastApplicationAt = condition;
      query.applicationsCount = { $gt: 0 };
    }

    // isApplication Filter
    if (filters.isApplication) {
      query.applicationsCount = { $gt: 0 };
    }

    // isInterview Filter
    if (filters.isInterview) {
      query.interviewCount = { $gt: 0 };
    }

    // Attach any collected andConditions to the query
    if (andConditions.length > 0) {
      query.$and = (query.$and || []).concat(andConditions);
    }

    const matchStage = {
      $or: [
        { companyInfo: { $size: 0 } },
        {
          $and: [
            { "companyInfo.0.status": { $ne: false } },
            { "companyInfo.0.kycStatus": { $ne: "rejected" } }
          ]
        }
      ]
    };

    // Build aggregation pipeline to filter by KYC status before pagination
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          let: { companyIdStr: "$companyId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$companyIdStr" }]
                }
              }
            }
          ],
          as: "companyInfo"
        }
      },
      {
        $match: matchStage
      }
    ];

    // Count total jobs AFTER KYC filtering
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Jobs.aggregate(countPipeline);
    const totalJobs = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalJobs / limit);

    // Sorting logic
    let sortStage = { createdAt: -1 };
    const sortOption = req.query.sort || filters.sort;
    if (sortOption === "lastApplicationAt") {
      sortStage = { lastApplicationAt: -1 };
    } else if (sortOption === "lastInterviewAt") {
      sortStage = { lastInterviewAt: -1 };
    } else if (sortOption === "salary" || sortOption === "highestSalary") {
      sortStage = { salary: -1 };
    } else if (sortOption === "salary_low" || sortOption === "lowestSalary") {
      sortStage = { salary: 1 };
    } else if (sortOption === "applicationsCount" || sortOption === "mostApplications") {
      sortStage = { applicationsCount: -1, createdAt: -1 };
    } else if (sortOption === "positions" || sortOption === "urgency" || sortOption === "urgent") {
      sortStage = { isUrgent: -1, createdAt: -1 };
    } else if (sortOption === "company_az") {
      sortStage = { companyName: 1, displayCompanyName: 1 };
    } else if (sortOption === "recent" || sortOption === "createdAt") {
      sortStage = { createdAt: -1 };
    }

    // Add sort, skip, and limit to main pipeline
    const allJobsLists = await Jobs.aggregate([
      ...pipeline,
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit }
    ]);

    const enrichedJobs = await Promise.all(
      allJobsLists.map(async (item) => {
        const userInfo = item.companyInfo?.[0];
        let job = { ...item };
        delete job.companyInfo; // Remove the lookup array

        job.isSaved = userId ? await getSavedJobsStatus(item._id, userId) : false;
        job.isApplied = userId ? await getIsAppliedStatus(item._id, userId) : false;
        job.profilePic = userInfo?.profilePic || job.profilePic;
        job.isPremiumClient = userInfo?.subscriptionStatus || false;
        job.companyName = userInfo?.companyName || job.companyName;
        job.jobLocation = formatLocation(job.jobLocation);

        if (job.isBudgetDisclosed === false && String(item.companyId) !== String(userId)) {
          delete job.budget;
        }
        return job;
      })
    );

    const arr = enrichedJobs;

    res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: arr,
      totalPages,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

module.exports = { getJobs };

const updateJobs = async (req, res) => {
  const body = req.body;
  console.log(body);
  if (body && body._id) {
    const jobs = await Jobs.findById({ _id: body._id });
    jobs.companyId = body.companyId;
    jobs.jobTitle = body.jobTitle;
    jobs.jobDescription = body.jobDescription;
    jobs.jobLocation = body.jobLocation;
    jobs.requiredSkills = body.requiredSkills;
    jobs.positions = body.positions;
    jobs.qualification = body.qualification;
    jobs.jobType = body.jobType;
    jobs.budget = body.budget;
    jobs.isBudgetDisclosed = body.isBudgetDisclosed;
    jobs.noticePeriod = body.noticePeriod;
    jobs.paymentType = body.paymentType;
    jobs.currency = body.currency;
    if (body.salary !== undefined && !Number.isNaN(Number(body.salary))) {
      let s = Number(body.salary);
      if (s > 0 && s <= 100) s = s * 100000;
      jobs.salary = s;
    } else if (body.budget) {
      const matches = String(body.budget).match(/\d+(\.\d+)?/g);
      if (matches && matches.length > 0) {
        let s = Number(matches[0]);
        if (s > 0 && s <= 100) s = s * 100000;
        jobs.salary = s;
      }
    }
    jobs.probabation = body.probabation;
    jobs.paymentTerms = body.paymentTerms;
    jobs.taxTerms = body.taxTerms;
    jobs.commission = body.commission;
    jobs.experience = body.experience;
    jobs.applicationType = body.applicationType;
    jobs.country = body.country;
    jobs.contractDays = body.contractDays;
    jobs.replacementDays = body.replacementDays;
    jobs.selectionType = body.selectionType;
    jobs.profilePic = body.profilePic;
    jobs.displayCompanyName = body.selectionType === "phaseB" ? body.companyName : PHASE_A_COMPANY_NAME;
    if (body.isUrgent !== undefined) {
      jobs.isUrgent = body.isUrgent;
    }
    const userObj = await jobs.save();
    res.status(200).json({
      success: true,
      message: "Successfully Updated",
      data: userObj,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "bad request",
    });
  }
};

const getAdminJobs = async (req, res) => {
  // try {
  //   const allJobs = await Jobs.find();
  //   res.status(200).json({
  //     success: true,
  //     message: "Successfully Updated",
  //     data: allJobs,
  //   });
  // } catch (error) {
  //   res.status(500).json({ success: false, error });
  // }

  try {
    const { userId, pageId = 1, pageSize = 10, filters = {} } = req.query;
    const limit = parseInt(pageSize);
    const skip = (parseInt(pageId) - 1) * limit;

    let query = {
      $expr: { $gt: [{ $toInt: "$positions" }, 0] },
    };
    const andConditions = [];

    // Status filter (defaults to ACTIVE if not provided)
    // Use "ALL" to return jobs of all statuses
    const statusFilter = filters.status || "ACTIVE";
    if (statusFilter !== "ALL") {
      query.status = statusFilter;
    }

    let isClient = false;
    // If userId is provided, check if it's a client user
    if (userId) {
      const user = await Users.findById(userId);
      if (user && user.userType === USER_TYPES.CLIENT) {
        // Client users can only see their own jobs
        query.companyId = userId;
        isClient = true;
      }
    }

    // Keyword Search
    if (filters.keyword) {
      const keywordRegex = new RegExp(escapeRegex(filters.keyword), "i");
      let companySearchCondition = { companyName: keywordRegex };;

      // if (isClient) {
      //   companySearchCondition = { companyName: keywordRegex };
      // } else {
      //   companySearchCondition = {
      //     $or: [
      //       {
      //         $and: [
      //           { selectionType: "phaseA" },
      //           { displayCompanyName: keywordRegex },
      //         ],
      //       },
      //       {
      //         $and: [
      //           { selectionType: { $ne: "phaseA" } },
      //           { companyName: keywordRegex },
      //         ],
      //       },
      //     ],
      //   };
      // }

      let orConditions = [
        { jobTitle: keywordRegex },
        companySearchCondition,
      ];
      if (mongoose.Types.ObjectId.isValid(filters.keyword)) {
        orConditions.push({ _id: filters.keyword });
      }
      query.$or = orConditions;
    }

    // Location
    if (filters.location) {
      const { countries, states, cities } = filters.location;
      if (countries) {
        const countryList = countries
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
        if (countryList.length > 0) {
          query.country = { $in: countryList.map((c) => new RegExp(escapeRegex(c), "i")) };
        }
      }
      let locations = [];
      if (states) locations.push(...states.split(",").map((s) => s.trim()));
      if (cities) locations.push(...cities.split(",").map((s) => s.trim()));
      locations = locations.filter((s) => s);

      if (locations.length > 0) {
        query.jobLocation = { $in: locations.map((l) => new RegExp(escapeRegex(l), "i")) };
      }
    }

    // Skills
    if (filters.skills) {
      const skillsList = filters.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      if (skillsList.length > 0) {
        query.requiredSkills = {
          $in: skillsList.map((s) => new RegExp(escapeRegex(s), "i")),
        };
      }
    }

    // Job Types
    if (filters.jobTypes) {
      const typesList = filters.jobTypes
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      if (typesList.length > 0) {
        query.jobType = { $in: typesList.map((t) => new RegExp(escapeRegex(t), "i")) };
      }
    }

    // Experience
    if (filters.requiredExperience) {
      const expList = filters.requiredExperience
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      if (expList.length > 0) {
        query.experience = { $in: expList.map((e) => new RegExp(escapeRegex(e), "i")) };
      }
    }

    // Work Mode
    if (filters.workMode) {
      const modeList = filters.workMode
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      if (modeList.length > 0) {
        query.applicationType = {
          $in: modeList.map((m) => new RegExp(escapeRegex(m), "i")),
        };
      }
    }

    // Qualifications
    if (filters.qualification) {
      const quaList = filters.qualification
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      if (quaList.length > 0) {
        query.qualification = { $in: quaList.map((q) => new RegExp(escapeRegex(q), "i")) };
      }
    }

    // Freshness
    if (filters.freshness) {
      const match = filters.freshness.match(/last (\d+)days/i);
      if (match) {
        const days = parseInt(match[1]);
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        query.createdAt = { $gte: dateFrom };
      }
    }

    // Application Freshness
    if (filters.applicationFreshness) {
      const freshness = filters.applicationFreshness.toLowerCase();
      let dateFrom;

      if (freshness === "last hour") {
        dateFrom = new Date(Date.now() - 60 * 60 * 1000);
      } else if (freshness === "today") {
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
      } else if (freshness === "this week") {
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (freshness === "last 30 days") {
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      let condition = { $exists: true }; // checks if lastApplicationAt key exists
      if (dateFrom) {
        condition.$gte = dateFrom;
      }
      query.lastApplicationAt = condition;
      query.applicationsCount = { $gt: 0 };
    }

    // isApplication Filter
    if (filters.isApplication) {
      query.applicationsCount = { $gt: 0 };
    }

    // isInterview Filter
    if (filters.isInterview) {
      query.interviewCount = { $gt: 0 };
    }

    // Attach any collected andConditions to the query
    if (andConditions.length > 0) {
      query.$and = (query.$and || []).concat(andConditions);
    }

    const matchStage = {
      $or: [
        { companyInfo: { $size: 0 } },
        {
          $and: [
            { "companyInfo.0.status": { $ne: false } },
            { "companyInfo.0.kycStatus": { $ne: "rejected" } }
          ]
        }
      ]
    };

    // Build aggregation pipeline to filter by KYC status before pagination
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          let: { companyIdStr: "$companyId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$companyIdStr" }]
                }
              }
            }
          ],
          as: "companyInfo"
        }
      },
      {
        $match: matchStage
      }
    ];

    // Count total jobs AFTER KYC filtering
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Jobs.aggregate(countPipeline);
    const totalJobs = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalJobs / limit);

    // Sorting logic
    let sortStage = { createdAt: -1 };
    const sortOption = req.query.sort || filters.sort;
    if (sortOption === "lastApplicationAt") {
      sortStage = { lastApplicationAt: -1 };
    } else if (sortOption === "lastInterviewAt") {
      sortStage = { lastInterviewAt: -1 };
    } else if (sortOption === "salary" || sortOption === "highestSalary") {
      sortStage = { salary: -1 };
    } else if (sortOption === "salary_low" || sortOption === "lowestSalary") {
      sortStage = { salary: 1 };
    } else if (sortOption === "applicationsCount" || sortOption === "mostApplications") {
      sortStage = { applicationsCount: -1, createdAt: -1 };
    } else if (sortOption === "positions" || sortOption === "urgency" || sortOption === "urgent") {
      sortStage = { isUrgent: -1, createdAt: -1 };
    } else if (sortOption === "company_az") {
      sortStage = { companyName: 1, displayCompanyName: 1 };
    } else if (sortOption === "recent" || sortOption === "createdAt") {
      sortStage = { createdAt: -1 };
    }

    // Add sort, skip, and limit to main pipeline
    const allJobsLists = await Jobs.aggregate([
      ...pipeline,
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit }
    ]);

    const enrichedJobs = await Promise.all(
      allJobsLists.map(async (item) => {
        const userInfo = item.companyInfo?.[0];
        let job = { ...item };
        // delete job.companyInfo; // Remove the lookup array

        job.isSaved = userId ? await getSavedJobsStatus(item._id, userId) : false;
        job.isApplied = userId ? await getIsAppliedStatus(item._id, userId) : false;
        job.profilePic = userInfo?.profilePic || job.profilePic;
        job.isPremiumClient = userInfo?.subscriptionStatus || false;
        job.companyName = userInfo?.companyName || job.companyName;
        job.jobLocation = formatLocation(job.jobLocation);

        return job;
      })
    );

    const arr = enrichedJobs;

    res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: arr,
      totalPages,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

const deactivateJob = async (req, res) => {
  try {
    const { newStatus, id, isUrgent } = req.body;
    const jobs = await Jobs.findOne({ _id: id });
    console.log(jobs);
    if (jobs) {
      if (newStatus !== undefined) jobs.status = newStatus;
      if (isUrgent !== undefined) jobs.isUrgent = isUrgent;
      await jobs.save();
      res.status(200).json({
        success: true,
        message: "Successfully Updated",
        data: jobs,
      });
    } else {
      res.status(403).json({
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const upsertSavedJob = async (req, res) => {
  try {
    const { jobId, userId: requestedUserId, isSaved } = req.body;
    const userId = String(req.user?._id || requestedUserId || "");

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (requestedUserId && req.user?._id && String(requestedUserId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "Cannot update another user's saved jobs" });
    }
    if (!mongoose.Types.ObjectId.isValid(jobId) || typeof isSaved !== "boolean") {
      return res.status(400).json({ success: false, message: "A valid job ID and saved state are required" });
    }
    if (isSaved && !(await Jobs.exists({ _id: jobId }))) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const query = { jobId: String(jobId), userId };
    const update = { $set: { isSaved } };
    if (isSaved) update.$set.createdAt = new Date();
    const upsertedData = await SavedJobs.findOneAndUpdate(query, update, {
      new: true,
      upsert: true,
    });
    if (upsertedData) {
      // Clean up any legacy duplicates so one user/job pair has one saved state.
      await SavedJobs.deleteMany({ ...query, _id: { $ne: upsertedData._id } });
      return res.status(200).json({
        success: true,
        message: "Successfully Updated",
      });
    }
    return res.status(500).json({ success: false, message: "Failed to save job" });
  } catch (error) {
    console.error("upsertSavedJob error:", error);
    return res.status(500).json({ success: false, message: "Failed to update saved job" });
  }
};

const getSavedJobsByUserId = async (req, res) => {
  const userId = String(req.user?._id || req.params.id || "");

  try {
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const savedList = await SavedJobs.find({ userId: userId, isSaved: true });
    let arr = [];

    console.log(savedList);

    await Promise.all(
      savedList.map(async (item) => {
        const jobDetails = await getJobslist(item?.jobId);
        arr.push(jobDetails);
      })
    );

    res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: arr,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

const getjobDetailsById = async (req, res) => {
  const jobId = req.params.id || req.query.id;
  const userId = req.query.userId || req.user?._id;
  if (!jobId) {
    // `return` was missing: execution continued into the next query anyway.
    return res.status(400).json({ success: false, message: "Job id is required" });
  }
  try {
    const data = await Jobs.findById(jobId);
    if (data) {
      let jobData = data.toObject();
      const userInfo = await Users.findOne({ _id: jobData.companyId });
      
      // Always evaluate candidate relationship (isSaved / isApplied) when userId is supplied
      jobData.isSaved = userId
        ? await getSavedJobsStatus(jobData?._id, userId)
        : false;

      jobData.isApplied = userId
        ? await getIsAppliedStatus(jobData?._id, userId)
        : false;

      if (userInfo) {
        if (!jobData.profilePic && userInfo.profilePic) {
          jobData.profilePic = userInfo.profilePic;
        }
        if (userInfo.subscriptionStatus !== undefined) {
          jobData.isPremiumClient = userInfo.subscriptionStatus;
        }
        if (userInfo.strengthOfCompany) {
          jobData.companySize = userInfo.strengthOfCompany;
        }
        if (userInfo.companyName && !jobData.companyName) {
          jobData.companyName = userInfo.companyName;
        }
      }

      // Handle Phase A masking
      if (jobData.selectionType === "phaseA") {
        jobData.companyName = PHASE_A_COMPANY_NAME;
        jobData.displayCompanyName = PHASE_A_COMPANY_NAME;
      } else {
        jobData.companyName = jobData.companyName || jobData.displayCompanyName || userInfo?.companyName || "Company";
        jobData.displayCompanyName = jobData.companyName;
      }

      // Total active job postings by this company / employer
      try {
        let companyJobQuery = {
          $expr: { $gt: [{ $toInt: "$positions" }, 0] },
          status: "ACTIVE",
        };
        if (jobData.selectionType === "phaseA") {
          companyJobQuery.selectionType = "phaseA";
        } else if (jobData.companyId) {
          companyJobQuery.companyId = jobData.companyId;
        }
        const totalCompanyJobs = await Jobs.countDocuments(companyJobQuery);
        jobData.companyJobsCount = totalCompanyJobs || 1;
        jobData.totalCompanyPostings = totalCompanyJobs || 1;
      } catch (countErr) {
        jobData.companyJobsCount = 1;
        jobData.totalCompanyPostings = 1;
      }

      if (jobData.isBudgetDisclosed === false && String(jobData.companyId) !== String(userId)) {
        delete jobData.budget;
      }
      jobData.jobLocation = formatLocation(jobData.jobLocation);
      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: jobData,
      });
    }
    // Valid ObjectId but no such job: 404, not a server error.
    return res.status(404).json({ success: false, message: "Job not found" });
  } catch (error) {
    // Invalid ObjectId throws a CastError - answer 400 instead of leaving
    // the request hanging after an unhandled rejection.
    return res.status(400).json({ success: false, message: "Invalid job id" });
  }
};

const getSavedJobs = async (req, res) => {
  try {
    const { userId: requestedUserId, pageId = 1, pageSize = 10, filters = {} } = req.query;
    const userId = String(req.user?._id || requestedUserId || "");

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const isClient = req.user?.userType === USER_TYPES.CLIENT;

    const savedJobsEntries = await SavedJobs.find({ userId, isSaved: true })
      .select("jobId createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    const savedAtByJobId = new Map();
    for (const entry of savedJobsEntries) {
      const id = String(entry.jobId);
      if (!savedAtByJobId.has(id) && mongoose.Types.ObjectId.isValid(id)) {
        savedAtByJobId.set(id, entry.createdAt);
      }
    }
    const savedJobIds = Array.from(savedAtByJobId.keys()).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    if (savedJobIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No saved jobs found",
        data: [],
        totalPages: 0,
        totalCount: 0,
      });
    }

    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 100);
    const page = Math.max(parseInt(pageId, 10) || 1, 1);
    const skip = (page - 1) * limit;

    let query = {
      _id: { $in: savedJobIds },
    };

    const andConditions = [];

    // Keyword Search
    if (filters.keyword) {
      const keywordRegex = new RegExp(escapeRegex(filters.keyword), "i");
      let companySearchCondition;

      if (isClient) {
        companySearchCondition = { companyName: keywordRegex };
      } else {
        companySearchCondition = {
          $or: [
            {
              $and: [
                { selectionType: "phaseA" },
                { displayCompanyName: keywordRegex },
              ],
            },
            {
              $and: [
                { selectionType: { $ne: "phaseA" } },
                { companyName: keywordRegex },
              ],
            },
          ],
        };
      }

      let orConditions = [
        { jobTitle: keywordRegex },
        { functionalArea: keywordRegex },
        { requiredSkills: keywordRegex },
        { jobLocation: keywordRegex },
        { jobDescription: keywordRegex },
        companySearchCondition,
      ];
      if (mongoose.Types.ObjectId.isValid(filters.keyword)) {
        orConditions.push({ _id: filters.keyword });
      }
      andConditions.push({ $or: orConditions });
    }

    // Category / Functional Area (Engineering, Design, Product, Marketing, Sales, etc.)
    const categoryParam = filters.category || filters.functionalArea;
    if (categoryParam) {
      const categoryList = (Array.isArray(categoryParam) ? categoryParam : String(categoryParam).split(","))
        .map((c) => c.trim())
        .filter(Boolean);

      if (categoryList.length > 0) {
        const categoryConditions = [];
        for (const cat of categoryList) {
          const catRegex = new RegExp(escapeRegex(cat), "i");
          const lowerCat = cat.toLowerCase();

          if (lowerCat.includes("engineer") || lowerCat.includes("tech") || lowerCat.includes("dev")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(developer|engineer|software|frontend|backend|full\s*stack|devops|mobile|ios|android|qa|architect|programmer|coder|sre|data\s*engineer)/i },
              { requiredSkills: /(react|node|javascript|typescript|python|java|c\+\+|golang|aws|cloud|sql|mongodb)/i }
            );
          } else if (lowerCat.includes("design") || lowerCat.includes("ui") || lowerCat.includes("ux")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(designer|ui|ux|visual|graphic|product\s*designer|illustrator|animator)/i },
              { requiredSkills: /(figma|adobe|photoshop|illustrator|sketch|ui\/ux|wireframing|prototyping)/i }
            );
          } else if (lowerCat.includes("product")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(product\s*manager|product\s*owner|product\s*lead|associate\s*product\s*manager|product\s*analyst|program\s*manager)/i }
            );
          } else if (lowerCat.includes("market") || lowerCat.includes("growth")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(marketing|growth|seo|content|social\s*media|campaign|brand|copywriter)/i },
              { requiredSkills: /(seo|sem|content|social\s*media|google\s*analytics|campaign|copywriting)/i }
            );
          } else if (lowerCat.includes("sale") || lowerCat.includes("business dev") || lowerCat.includes("revenue")) {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: /(sales|bdr|sdr|business\s*development|account\s*executive|account\s*manager|revenue)/i }
            );
          } else {
            categoryConditions.push(
              { functionalArea: catRegex },
              { jobTitle: catRegex },
              { requiredSkills: catRegex }
            );
          }
        }
        if (categoryConditions.length > 0) {
          andConditions.push({ $or: categoryConditions });
        }
      }
    }

    // Location (supports string, array, or object)
    if (filters.location) {
      if (typeof filters.location === "string") {
        const locRegex = new RegExp(escapeRegex(filters.location.trim()), "i");
        andConditions.push({
          $or: [
            { jobLocation: locRegex },
            { country: locRegex },
          ],
        });
      } else {
        const { countries, states, cities } = filters.location;
        if (countries) {
          const countryList = countries
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
          if (countryList.length > 0) {
            query.country = { $in: countryList.map((c) => new RegExp(escapeRegex(c), "i")) };
          }
        }
        let locations = [];
        if (states) locations.push(...states.split(",").map((s) => s.trim()));
        if (cities) locations.push(...cities.split(",").map((s) => s.trim()));
        locations = locations.filter((s) => s);

        if (locations.length > 0) {
          query.jobLocation = { $in: locations.map((l) => new RegExp(escapeRegex(l), "i")) };
        }
      }
    }

    // Skills (supports array or comma-separated string)
    if (filters.skills) {
      const skillsList = (Array.isArray(filters.skills) ? filters.skills : String(filters.skills).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (skillsList.length > 0) {
        query.requiredSkills = {
          $in: skillsList.map((s) => new RegExp(escapeRegex(s), "i")),
        };
      }
    }

    // Job Types (supports array or comma-separated string)
    const rawJobTypes = filters.jobTypes || filters.jobType;
    if (rawJobTypes) {
      const typesList = (Array.isArray(rawJobTypes) ? rawJobTypes : String(rawJobTypes).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (typesList.length > 0) {
        query.jobType = { $in: typesList.map((t) => new RegExp(escapeRegex(t), "i")) };
      }
    }

    // Experience (supports array or comma-separated string)
    const rawExp = filters.requiredExperience || filters.experience;
    if (rawExp) {
      const expList = (Array.isArray(rawExp) ? rawExp : String(rawExp).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (expList.length > 0) {
        query.experience = { $in: expList.map((e) => new RegExp(escapeRegex(e), "i")) };
      }
    }

    // Work Mode (supports array or comma-separated string)
    if (filters.workMode) {
      const modeList = (Array.isArray(filters.workMode) ? filters.workMode : String(filters.workMode).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (modeList.length > 0) {
        query.applicationType = {
          $in: modeList.map((m) => new RegExp(escapeRegex(m), "i")),
        };
      }
    }

    // Qualifications (supports array or comma-separated string)
    if (filters.qualification) {
      const quaList = (Array.isArray(filters.qualification) ? filters.qualification : String(filters.qualification).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (quaList.length > 0) {
        query.qualification = { $in: quaList.map((q) => new RegExp(escapeRegex(q), "i")) };
      }
    }

    // Salary Filters (min and max)
    const minSalary = Number(filters.salaryMin || filters.minSalary);
    if (!isNaN(minSalary) && minSalary > 0) {
      query.salary = { ...(query.salary || {}), $gte: minSalary };
    }
    const maxSalary = Number(filters.salaryMax || filters.maxSalary);
    if (!isNaN(maxSalary) && maxSalary > 0) {
      query.salary = { ...(query.salary || {}), $lte: maxSalary };
    }

    // Freshness (supports "last Ndays", "24h", "3 days", "7 days", "30 days")
    const rawFreshness = filters.freshness || filters.postedWithin;
    if (rawFreshness) {
      let days = 0;
      const match = String(rawFreshness).match(/last (\d+)days/i);
      if (match) {
        days = parseInt(match[1]);
      } else if (/24h|1\s*day/i.test(rawFreshness)) {
        days = 1;
      } else if (/3\s*days/i.test(rawFreshness)) {
        days = 3;
      } else if (/7\s*days|week/i.test(rawFreshness)) {
        days = 7;
      } else if (/14\s*days/i.test(rawFreshness)) {
        days = 14;
      } else if (/30\s*days|month/i.test(rawFreshness)) {
        days = 30;
      }
      if (days > 0) {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        query.createdAt = { $gte: dateFrom };
      }
    }

    // Attach any collected andConditions to the query
    if (andConditions.length > 0) {
      query.$and = (query.$and || []).concat(andConditions);
    }

    const totalJobs = await Jobs.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / limit);

    const allJobsLists = await Jobs.aggregate([
      { $match: query },
      {
        $addFields: {
          savedOrder: { $indexOfArray: [savedJobIds, "$_id"] },
        },
      },
      { $sort: { savedOrder: 1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { savedOrder: 0 } },
    ]);

    const enrichedJobs = await Promise.all(
      allJobsLists.map(async (item) => {
        const userInfo = await Users.findOne({ _id: item.companyId });
        let job = { ...item };
        // For saved jobs list, isSaved is inherently true for the current user
        job.isSaved = true;
        job.savedAt = savedAtByJobId.get(String(item._id));
        job.isApplied = await getIsAppliedStatus(item?._id, userId);
        job.profilePic = userInfo?.profilePic || job.profilePic;
        job.isPremiumClient = userInfo?.subscriptionStatus || false;
        job.companyName = userInfo?.companyName || job.companyName || job.displayCompanyName || "Verified Employer";
        job.displayCompanyName = job.companyName;

        if (job.isBudgetDisclosed === false && String(item.companyId) !== String(userId)) {
          delete job.budget;
        }
        return job;
      })
    );

    const arr = enrichedJobs.filter((j) => j !== null);

    res.status(200).json({
      success: true,
      message: "Successfully fetched saved jobs",
      data: arr,
      totalPages,
      totalCount: totalJobs,
    });
  } catch (error) {
    console.error("getSavedJobs error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch saved jobs" });
  }
};

module.exports = {
  addJobs,
  getJobs,
  updateJobs,
  getAdminJobs,
  deactivateJob,
  upsertSavedJob,
  getSavedJobsByUserId,
  getjobDetailsById,
  getSavedJobs,
};
