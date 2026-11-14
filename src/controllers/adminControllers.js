const {
  getMonthDateRange,
  getMonthName,
  getLastSunday,
  getDayDateRange,
  getDayName,
} = require("../helpers/helper");
const JobsApplications = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const Users = require("../models/userModel");
const User = require("../models/userModel");
const Notifications = require("../models/notificatonModel");
const BroadcastLog = require("../models/broadcastLogModel");
const EmailBroadcastLog = require("../models/emailBroadcastLogModel");
const { sendBatchEmails, createBrandedHtmlEmail } = require("../helpers/emailHelper");
const {
  sendPushNotification,
  sendBatchPushNotifications,
} = require("../helpers/pushNotificationHelper");
const {
  getJobslist,
  getVendorlist,
  getemployeeList,
} = require("./jobsApplicationsController");

const getUsersDataForAdmin = async (req, res) => {
  try {
    const { period, year, month } = req.params;

    // Check if the period is 'months' to return records for all past months
    if (period === "months") {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const monthsData = [];

      // Loop through all months from January to the current month
      for (let monthIndex = 0; monthIndex <= currentMonth; monthIndex++) {
        const { startDate, endDate } = getMonthDateRange(
          currentYear,
          monthIndex
        );
        const records = await User.find({
          createdAt: { $gte: startDate, $lte: endDate },
        });

        monthsData.push({
          month: getMonthName(monthIndex),
          records,
        });
      }

      return res.json({ months: monthsData });
    }

    // Check if specific year and month are provided for date-wise data
    if (year && month) {
      const parsedYear = parseInt(year, 10);
      const parsedMonth = parseInt(month, 10) - 1; // Month is 0-indexed

      if (parsedYear && parsedMonth >= 0) {
        const { startDate, endDate } = getMonthDateRange(
          parsedYear,
          parsedMonth
        );

        const monthData = [];
        let currentDate = new Date(startDate); // Start with the first day of the month

        // Loop through all days of the specified month
        while (currentDate <= endDate) {
          const { startDate: dayStart, endDate: dayEnd } =
            getDayDateRange(currentDate);
          const records = await User.find({
            createdAt: { $gte: dayStart, $lte: dayEnd },
          });

          // Push the day's data into the array
          monthData.push({
            day: currentDate.toISOString(), // Use a distinct date for each day
            records,
          });

          currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
        }

        return res.json({
          month: getMonthName(parsedMonth),
          year: parsedYear,
          data: monthData,
        });
      }
    }

    if (period === "week") {
      const lastSunday = getLastSunday();
      const weekData = [];

      // Loop through the days from Sunday to Saturday
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(lastSunday);
        currentDate.setDate(lastSunday.getDate() + i);

        const { startDate, endDate } = getDayDateRange(currentDate);
        const records = await User.find({
          createdAt: { $gte: startDate, $lte: endDate },
        });

        weekData.push({
          day: getDayName(currentDate),
          records,
        });
      }

      return res.json({ week: weekData });
    }

    // For 'day', 'week', 'year', use existing logic
    const getDateRange = (period) => {
      const now = new Date();
      let startDate;

      switch (period) {
        case "day":
          startDate = new Date(now.setDate(now.getDate() - 1)); // Last 24 hours
          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1)); // Last year
          break;
        default:
          throw new Error("Invalid period");
      }

      return { startDate, endDate: new Date() };
    };

    const { startDate, endDate } = getDateRange(period);

    const records = await User.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    res.json({ records });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getJobDataForAdmin = async (req, res) => {
  try {
    const { period, year, month } = req.params;

    // Check if the period is 'month' to return records for all past months
    if (period === "months") {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const monthsData = [];

      // Loop through all months from January to the current month
      for (let monthIndex = 0; monthIndex <= currentMonth; monthIndex++) {
        const { startDate, endDate } = getMonthDateRange(
          currentYear,
          monthIndex
        );
        const records = await Jobs.find({
          createdAt: { $gte: startDate, $lte: endDate },
        });

        monthsData.push({
          month: getMonthName(monthIndex),
          records,
        });
      }

      return res.json({ months: monthsData });
    }
    // Check if specific year and month are provided for date-wise data
    if (year && month) {
      const parsedYear = parseInt(year, 10);
      const parsedMonth = parseInt(month, 10) - 1; // Month is 0-indexed

      if (parsedYear && parsedMonth >= 0) {
        const { startDate, endDate } = getMonthDateRange(
          parsedYear,
          parsedMonth
        );

        const monthData = [];
        let currentDate = new Date(startDate); // Start with the first day of the month

        // Loop through all days of the specified month
        while (currentDate <= endDate) {
          const { startDate: dayStart, endDate: dayEnd } =
            getDayDateRange(currentDate);
          const records = await Jobs.find({
            createdAt: { $gte: dayStart, $lte: dayEnd },
          });

          // Push the day's data into the array
          monthData.push({
            day: currentDate.toISOString(), // Use a distinct date for each day
            records,
          });

          currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
        }

        return res.json({
          month: getMonthName(parsedMonth),
          year: parsedYear,
          data: monthData,
        });
      }
    }
    if (period === "week") {
      const lastSunday = getLastSunday();
      const weekData = [];

      // Loop through the days from Sunday to Saturday
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(lastSunday);
        currentDate.setDate(lastSunday.getDate() + i);

        const { startDate, endDate } = getDayDateRange(currentDate);
        const records = await Jobs.find({
          createdAt: { $gte: startDate, $lte: endDate },
        });

        weekData.push({
          day: getDayName(currentDate),
          records,
        });
      }

      return res.json({ week: weekData });
    }

    // For 'day', 'week', 'year', use existing logic
    const getDateRange = (period) => {
      const now = new Date();
      let startDate;

      switch (period) {
        case "day":
          startDate = new Date(now.setDate(now.getDate() - 1)); // Last 24 hours

          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1)); // Last year
          break;
        default:
          throw new Error("Invalid period");
      }

      return { startDate, endDate: new Date() };
    };

    const { startDate, endDate } = getDateRange(period);

    const records = await Jobs.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    res.json({ records });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getJobApplicationsAdmin = async (req, res) => {
  try {
    const { period, year, month } = req.params;

    // Check if the period is 'month' to return records for all past months
    if (period === "months") {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const monthsData = [];

      // Loop through all months from January to the current month
      for (let monthIndex = 0; monthIndex <= currentMonth; monthIndex++) {
        const { startDate, endDate } = getMonthDateRange(
          currentYear,
          monthIndex
        );
        const records = await JobsApplications.find({
          createdAt: { $gte: startDate, $lte: endDate },
        });

        monthsData.push({
          month: getMonthName(monthIndex),
          records,
        });
      }

      return res.json({ months: monthsData });
    }
    // Check if specific year and month are provided for date-wise data
    if (year && month) {
      const parsedYear = parseInt(year, 10);
      const parsedMonth = parseInt(month, 10) - 1; // Month is 0-indexed

      if (parsedYear && parsedMonth >= 0) {
        const { startDate, endDate } = getMonthDateRange(
          parsedYear,
          parsedMonth
        );

        const monthData = [];
        let currentDate = new Date(startDate); // Start with the first day of the month

        // Loop through all days of the specified month
        while (currentDate <= endDate) {
          const { startDate: dayStart, endDate: dayEnd } =
            getDayDateRange(currentDate);
          const records = await JobsApplications.find({
            createdAt: { $gte: dayStart, $lte: dayEnd },
          });

          // Push the day's data into the array
          monthData.push({
            day: currentDate.toISOString(), // Use a distinct date for each day
            records,
          });

          currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
        }

        return res.json({
          month: getMonthName(parsedMonth),
          year: parsedYear,
          data: monthData,
        });
      }
    }
    if (period === "week") {
      const lastSunday = getLastSunday();
      const weekData = [];

      // Loop through the days from Sunday to Saturday
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(lastSunday);
        currentDate.setDate(lastSunday.getDate() + i);

        const { startDate, endDate } = getDayDateRange(currentDate);
        const records = await JobsApplications.find({
          createdAt: { $gte: startDate, $lte: endDate },
        });

        weekData.push({
          day: getDayName(currentDate),
          records,
        });
      }

      return res.json({ week: weekData });
    }

    // For 'day', 'week', 'year', use existing logic
    const getDateRange = (period) => {
      const now = new Date();
      let startDate;

      switch (period) {
        case "day":
          startDate = new Date(now.setDate(now.getDate() - 1)); // Last 24 hours

          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1)); // Last year
          break;
        default:
          throw new Error("Invalid period");
      }

      return { startDate, endDate: new Date() };
    };

    const { startDate, endDate } = getDateRange(period);

    const records = await JobsApplications.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    res.json({ records });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getJobApplicationForAdminUserWise = async (req, res) => {
  const { type } = req.params;

  if (!type) {
    return res.status(400).json({
      success: false,
      message: "parameter type is required",
    });
  }
  let arr = [];
  if (type === "vendor") {
    const data = await JobsApplications.find({ employeeId: { $exists: true } });
    console.log(data, "datatas");
    const a = Promise.all(
      data.map(async (element) => {
        const obj = {};
        obj.jobDetails = await getJobslist(element?.jobId);
        obj.vendorDetails = await getVendorlist(element?.companyId);
        obj.applicationId = element._id;
        obj.employeeList = await getemployeeList(element.employeeId);
        obj.status = element.status;
        obj.resume = element.resume;
        obj.sentAt = element.sentAt;
        obj.budgetPercentage = element?.budgetPercentage;
        obj.contractDate = element?.contractDate;
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
      console.log(error);
      res.status(500).json({ error });
    });
  }
  if (type === "jobSeeker") {
    const data = await JobsApplications.find({
      employeeId: { $exists: false },
    });
    const a = Promise.all(
      data.map(async (element) => {
        const obj = {};
        obj.jobDetails = await getJobslist(element?.jobId);
        obj.vendorDetails = await getVendorlist(element?.companyId);
        obj.applicationId = element._id;
        obj.status = element.status;
        obj.resume = element.resume;
        obj.sentAt = element.sentAt;
        obj._id = element._id;
        obj.budgetPercentage = element?.budgetPercentage;
        obj.contractDate = element?.contractDate;
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
      res.status(500).json({ error });
    });
  }
};

const getJobApplicationsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      freshness,
      subscriptionStatus,
      lastUpdatedAt,
      userType,
      status,
      sortBy
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Match stage 1: direct fields on JobsApplications
    const matchStage1 = {};

    if (freshness) {
      const now = new Date();
      let pastDate = new Date();
      if (freshness === '24h' || freshness === '24 hours' || freshness === 'last 24hours') pastDate.setHours(now.getHours() - 24);
      else if (freshness === '7d' || freshness === '7 days' || freshness === 'last 7days') pastDate.setDate(now.getDate() - 7);
      else if (freshness === '30d' || freshness === '30 days' || freshness === 'last 30days') pastDate.setDate(now.getDate() - 30);
      else pastDate = null;

      if (pastDate) {
        matchStage1.sentAt = { $gte: pastDate };
      }
    }

    if (lastUpdatedAt) {
      const now = new Date();
      let pastDate = new Date();
      if (lastUpdatedAt === '24h' || lastUpdatedAt === '24 hours' || lastUpdatedAt === 'last 24hours') pastDate.setHours(now.getHours() - 24);
      else if (lastUpdatedAt === '7d' || lastUpdatedAt === '7 days' || lastUpdatedAt === 'last 7days') pastDate.setDate(now.getDate() - 7);
      else if (lastUpdatedAt === '30d' || lastUpdatedAt === '30 days' || lastUpdatedAt === 'last 30days') pastDate.setDate(now.getDate() - 30);
      else pastDate = null;

      if (pastDate) {
        matchStage1.lastUpdatedAt = { $gte: pastDate };
      }
    }

    if (userType === 'jobseeker') {
      matchStage1.employeeId = { $exists: false };
    } else if (userType === 'bench resources') {
      matchStage1.employeeId = { $exists: true };
    }

    if (status) {
      matchStage1.status = status.toUpperCase();
    }

    const pipeline = [];

    if (Object.keys(matchStage1).length > 0) {
      pipeline.push({ $match: matchStage1 });
    }

    // Lookups for Search and Subscription filtering
    pipeline.push({
      $lookup: {
        from: "users",
        let: {
          compId: { $convert: { input: "$companyId", to: "objectId", onError: null, onNull: null } }
        },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$compId"] } } }
        ],
        as: "vendorDetails"
      }
    });
    pipeline.push({ $unwind: { path: "$vendorDetails", preserveNullAndEmptyArrays: true } });

    pipeline.push({
      $lookup: {
        from: "employeeonboardings",
        let: {
          empId: { $convert: { input: "$employeeId", to: "objectId", onError: null, onNull: null } }
        },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$empId"] } } }
        ],
        as: "employeeDetails"
      }
    });
    pipeline.push({ $unwind: { path: "$employeeDetails", preserveNullAndEmptyArrays: true } });

    // Lookup Job Details for search by jobTitle and companyName
    pipeline.push({
      $lookup: {
        from: "jobs",
        let: {
          jobIdVal: { $convert: { input: "$jobId", to: "objectId", onError: null, onNull: null } }
        },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$jobIdVal"] } } }
        ],
        as: "jobLookup"
      }
    });
    pipeline.push({ $unwind: { path: "$jobLookup", preserveNullAndEmptyArrays: true } });

    pipeline.push({
      $addFields: {
        applicantName: {
          $cond: {
            if: { $ifNull: ["$employeeDetails", false] },
            then: "$employeeDetails.name",
            else: { $concat: ["$vendorDetails.firstName", " ", "$vendorDetails.lastName"] }
          }
        },
        vendorName: { $concat: ["$vendorDetails.firstName", " ", "$vendorDetails.lastName"] },
        vendorCompanyName: "$vendorDetails.companyName"
      }
    });

    const matchStage2 = {};

    if (subscriptionStatus !== undefined && subscriptionStatus !== '') {
      const isSubscribed = subscriptionStatus === 'true' || subscriptionStatus === true;
      matchStage2["vendorDetails.subscriptionStatus"] = isSubscribed;
    }

    if (search) {
      matchStage2.$or = [
        { applicantName: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
        { vendorCompanyName: { $regex: search, $options: "i" } },
        { "jobLookup.jobTitle": { $regex: search, $options: "i" } },
        { "jobLookup.companyName": { $regex: search, $options: "i" } },
        { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: search, options: "i" } } }
      ];
    }

    if (Object.keys(matchStage2).length > 0) {
      pipeline.push({ $match: matchStage2 });
    }

    let sortObj = { sentAt: -1 };
    if (sortBy === 'Application Received Date & Time' || sortBy === 'sentAt') {
      sortObj = { sentAt: -1 };
    } else if (sortBy === 'Last Application Updated' || sortBy === 'lastUpdatedAt') {
      sortObj = { lastUpdatedAt: -1 };
    } else if (sortBy === 'Last Interview Date & Time' || sortBy === 'lastInterviewAt') {
      sortObj = { lastInterviewAt: -1 };
    }
    pipeline.push({ $sort: sortObj });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limitNumber }
        ]
      }
    });

    const result = await JobsApplications.aggregate(pipeline);

    const data = result[0].data || [];
    const total = (result[0].metadata && result[0].metadata[0]) ? result[0].metadata[0].total : 0;
    const totalPages = Math.ceil(total / limitNumber);

    const formattedData = await Promise.all(
      data.map(async (element) => {
        const obj = { ...element };
        try {
          if (element.jobId) obj.jobDetails = await getJobslist(element.jobId);
          if (element.companyId) obj.vendorDetails = await getVendorlist(element.companyId);
          if (element.clientId) obj.clientDetails = await getVendorlist(element.clientId);
          if (element.employeeId) obj.employeeList = await getemployeeList(element.employeeId);
        } catch (e) {
          console.error(`Error fetching additional details for app ${element._id}:`, e);
        }
        obj.applicationId = element._id;
        return obj;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: formattedData,
      pagination: {
        totalItems: total,
        totalPages: totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber
      }
    });

  } catch (error) {
    console.error("Error in getJobApplicationsForAdmin:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const registerClient = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      country,
      password,
      role,
      userType,
      companyName,
      companyRepresentative,
      strengthOfCompany,
      designation,
      exprience,
      countryCode,
      subscriptionStatus,
      skills,
    } = req.body;
    const userData = await Users.findOne({ email: email });
    if (userData && !userData?.status) {
      console.log(userData);
      userData.firstName = firstName;
      userData.lastName = lastName;
      userData.phone = phone;
      userData.email = email;
      userData.country = country;
      userData.password = password;
      userData.role = role;
      userData.userType = userType;
      userData.companyName = companyName;
      userData.companyRepresentative = companyRepresentative;
      userData.strengthOfCompany = strengthOfCompany;
      userData.designation = designation;
      userData.exprience = exprience;
      userData.countryCode = countryCode;
      userData.otpVerified = false;
      userData.status = true;
      userData.subscriptionStatus = false;
      userData.skills = skills;
      await userData.save();
      const userData2 = await User.findOne({ email: email });
      if (userData2) {
        let response = {};
        res.status(200).json({
          success: true,
          data: userData2?._id,
        });
      }
    } else if (userData && userData.status) {
      res
        .status(500)
        .json({ success: false, error: "Email or Phone Already exists" });
    } else {
      const userObj = await Users.create({
        firstName,
        lastName,
        phone,
        email,
        country,
        password,
        role,
        userType,
        companyName,
        companyRepresentative,
        strengthOfCompany,
        designation,
        exprience,
        skills,
        countryCode,
        subscriptionStatus,
        otpVerified: true,
      });
      if (userObj) {
        let response = {};
        res.status(200).json({
          success: true,
          data: userObj?._id,
        });
      }
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

/**
 * Return audience statistics for push broadcast (total count + count with valid push tokens).
 */
const getBroadcastAudienceCounts = async (req, res) => {
  try {
    const isTokenValid = {
      pushNotif: { $ne: false },
      pushToken: { $regex: /^Expo(nent)?PushToken\[/ },
    };

    const [
      totalAll,
      tokensAll,
      totalJobSeekers,
      tokensJobSeekers,
      totalClients,
      tokensClients,
      totalPartners,
      tokensPartners,
    ] = await Promise.all([
      User.countDocuments({ status: true }),
      User.countDocuments({ status: true, ...isTokenValid }),
      User.countDocuments({ status: true, userType: "personal" }),
      User.countDocuments({ status: true, userType: "personal", ...isTokenValid }),
      User.countDocuments({ status: true, userType: "client" }),
      User.countDocuments({ status: true, userType: "client", ...isTokenValid }),
      User.countDocuments({ status: true, userType: { $in: ["company", "individual"] } }),
      User.countDocuments({
        status: true,
        userType: { $in: ["company", "individual"] },
        ...isTokenValid,
      }),
    ]);

    return res.status(200).json({
      success: true,
      counts: {
        all: { total: totalAll, withToken: tokensAll },
        jobseekers: { total: totalJobSeekers, withToken: tokensJobSeekers },
        clients: { total: totalClients, withToken: tokensClients },
        partners: { total: totalPartners, withToken: tokensPartners },
      },
    });
  } catch (error) {
    console.error("Error in getBroadcastAudienceCounts:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Search users by name/email/phone for single-user push targeting.
 */
const searchUsersForPush = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) {
      return res.status(200).json({ success: true, users: [] });
    }

    const regex = new RegExp(q, "i");
    const users = await User.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
        { companyName: regex },
      ],
    })
      .select("firstName lastName email phone userType companyName pushToken pushNotif")
      .limit(20)
      .lean();

    const formatted = users.map((u) => {
      const hasToken =
        Boolean(u.pushToken) &&
        (u.pushToken.startsWith("ExponentPushToken[") || u.pushToken.startsWith("ExpoPushToken["));
      return {
        _id: u._id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.companyName || u.email,
        email: u.email,
        phone: u.phone,
        userType: u.userType,
        companyName: u.companyName,
        hasPushToken: hasToken,
        pushNotif: u.pushNotif !== false,
      };
    });

    return res.status(200).json({ success: true, users: formatted });
  } catch (error) {
    console.error("Error in searchUsersForPush:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Send push notification to a single user or broadcast to segments (jobseekers, clients, partners, all).
 */
const sendAdminPushNotification = async (req, res) => {
  try {
    const { target, userId, title, body, deepLink, saveInApp = false } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: "Notification title is required" });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, error: "Notification message body is required" });
    }
    if (!target || !["all", "jobseekers", "clients", "partners", "single"].includes(target)) {
      return res.status(400).json({ success: false, error: "Valid target audience is required" });
    }

    let targetQuery = {};
    let targetUserName = null;
    let targetUserEmail = null;

    if (target === "single") {
      if (!userId) {
        return res.status(400).json({ success: false, error: "Target userId is required for single-user push" });
      }
      targetQuery = { _id: userId };
    } else if (target === "jobseekers") {
      targetQuery = { userType: "personal", status: true };
    } else if (target === "clients") {
      targetQuery = { userType: "client", status: true };
    } else if (target === "partners") {
      targetQuery = { userType: { $in: ["company", "individual"] }, status: true };
    } else if (target === "all") {
      targetQuery = { status: true };
    }

    // Fetch targeted users
    const users = await User.find(targetQuery)
      .select("_id firstName lastName email companyName pushToken pushNotif")
      .lean();

    const totalTargeted = users.length;
    if (totalTargeted === 0) {
      return res.status(404).json({ success: false, error: "No matching active users found for this target." });
    }

    if (target === "single" && users[0]) {
      const u = users[0];
      targetUserName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.companyName || u.email;
      targetUserEmail = u.email;
    }

    // Filter recipients eligible for Expo Push Notifications
    const pushEligibleUsers = users.filter((u) => {
      if (u.pushNotif === false) return false;
      const tok = String(u.pushToken || "").trim();
      return tok.startsWith("ExponentPushToken[") || tok.startsWith("ExpoPushToken[");
    });

    const tokensCount = pushEligibleUsers.length;

    // Prepare push notification messages
    const pushMessages = pushEligibleUsers.map((u) => ({
      to: u.pushToken,
      title: title.trim(),
      body: body.trim(),
      data: {
        deepLink: deepLink || "/notifications",
        type: "ADMIN_BROADCAST",
      },
    }));

    // Dispatch batch push notifications via Expo API
    let deliveredCount = 0;
    if (pushMessages.length > 0) {
      const batchResult = await sendBatchPushNotifications(pushMessages);
      deliveredCount = batchResult.deliveredCount;
    }

    // Save In-App Notification in bulk (if saveInApp is enabled)
    if (saveInApp === true) {
      const inAppDocs = users.map((u) => ({
        userId: String(u._id),
        type: "ADMIN_BROADCAST",
        title: title.trim(),
        details: body.trim(),
        status: "New",
        notificationDetail: deepLink || "/notifications",
        sentAt: new Date(),
        isClear: false,
      }));

      // Insert in chunks of 500 to avoid overloading Mongo
      const CHUNK = 500;
      for (let i = 0; i < inAppDocs.length; i += CHUNK) {
        const docChunk = inAppDocs.slice(i, i + CHUNK);
        await Notifications.insertMany(docChunk, { ordered: false }).catch((err) => {
          console.warn("[AdminPush] Error bulk inserting in-app notifications chunk:", err?.message);
        });
      }
    }

    // Log the broadcast in BroadcastLog
    const logDoc = await BroadcastLog.create({
      title: title.trim(),
      body: body.trim(),
      target,
      targetUserId: target === "single" ? userId : null,
      targetUserName,
      targetUserEmail,
      deepLink: deepLink || "",
      totalTargeted,
      tokensCount,
      deliveredCount,
      sentBy: req.user?._id || null,
      status: deliveredCount > 0 || tokensCount === 0 ? "DELIVERED" : "PARTIAL",
    });

    return res.status(200).json({
      success: true,
      message: `Notification successfully processed. Targeted ${totalTargeted} users, dispatched ${deliveredCount} push notifications.`,
      data: {
        broadcastId: logDoc._id,
        totalTargeted,
        tokensCount,
        deliveredCount,
      },
    });
  } catch (error) {
    console.error("Error in sendAdminPushNotification:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get paginated history of past broadcasts.
 */
const getBroadcastHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [total, list] = await Promise.all([
      BroadcastLog.countDocuments({}),
      BroadcastLog.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "sentBy", model: "Users", select: "firstName lastName email" })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error in getBroadcastHistory:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get count of users with valid emails per audience segment.
 */
const getBroadcastEmailAudienceCounts = async (req, res) => {
  try {
    const hasValidEmail = {
      email: { $exists: true, $ne: "", $not: /@phone\.hireinsecond\.com$/i },
      status: true,
    };

    const [
      totalAll,
      totalJobSeekers,
      totalClients,
      totalPartners,
    ] = await Promise.all([
      User.countDocuments(hasValidEmail),
      User.countDocuments({ ...hasValidEmail, userType: "personal" }),
      User.countDocuments({ ...hasValidEmail, userType: "client" }),
      User.countDocuments({
        ...hasValidEmail,
        userType: { $in: ["company", "individual"] },
      }),
    ]);

    return res.status(200).json({
      success: true,
      counts: {
        all: { total: totalAll },
        jobseekers: { total: totalJobSeekers },
        clients: { total: totalClients },
        partners: { total: totalPartners },
      },
    });
  } catch (error) {
    console.error("Error in getBroadcastEmailAudienceCounts:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Send email broadcast to targeted segment or individual user.
 */
const sendAdminEmailBroadcast = async (req, res) => {
  try {
    const { target, userId, subject, body } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, error: "Email subject is required" });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, error: "Email message body is required" });
    }
    if (!target || !["all", "jobseekers", "clients", "partners", "single"].includes(target)) {
      return res.status(400).json({ success: false, error: "Valid target audience is required" });
    }

    const baseEmailFilter = {
      email: { $exists: true, $ne: "", $not: /@phone\.hireinsecond\.com$/i },
      status: true,
    };

    let users = [];
    let targetUserName = null;
    let targetUserEmail = null;

    if (target === "single") {
      if (!userId) {
        return res.status(400).json({ success: false, error: "Target userId is required for single email dispatch" });
      }
      const singleUser = await User.findById(userId).select("firstName lastName email companyName").lean();
      if (!singleUser || !singleUser.email || singleUser.email.endsWith("@phone.hireinsecond.com")) {
        return res.status(404).json({ success: false, error: "Target user has no valid email address" });
      }
      users = [singleUser];
      targetUserName = `${singleUser.firstName || ""} ${singleUser.lastName || ""}`.trim() || singleUser.companyName;
      targetUserEmail = singleUser.email;
    } else {
      let query = { ...baseEmailFilter };
      if (target === "jobseekers") {
        query.userType = "personal";
      } else if (target === "clients") {
        query.userType = "client";
      } else if (target === "partners") {
        query.userType = { $in: ["company", "individual"] };
      }

      users = await User.find(query).select("firstName lastName email companyName").lean();
    }

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No recipients with valid email addresses found in the selected audience.",
      });
    }

    // Dispatch batch emails with rate-controlled worker
    const batchResult = await sendBatchEmails(users, {
      subject: subject.trim(),
      bodyHtml: body.trim(),
    });

    const status =
      batchResult.deliveredCount === batchResult.total
        ? "DELIVERED"
        : batchResult.deliveredCount > 0
        ? "PARTIAL"
        : "FAILED";

    // Log the broadcast in EmailBroadcastLog
    const logDoc = await EmailBroadcastLog.create({
      subject: subject.trim(),
      body: body.trim(),
      target,
      targetUserId: target === "single" ? userId : null,
      targetUserName,
      targetUserEmail,
      totalTargeted: batchResult.total,
      deliveredCount: batchResult.deliveredCount,
      failedCount: batchResult.failedCount,
      sentBy: req.user?._id || null,
      status,
      errorLogs: batchResult.errors || [],
    });

    return res.status(200).json({
      success: true,
      message: `Successfully dispatched to ${batchResult.deliveredCount} recipient(s).`,
      totalTargeted: batchResult.total,
      deliveredCount: batchResult.deliveredCount,
      failedCount: batchResult.failedCount,
      log: logDoc,
    });
  } catch (error) {
    console.error("Error in sendAdminEmailBroadcast:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get paginated history of past email broadcasts.
 */
const getEmailBroadcastHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [total, list] = await Promise.all([
      EmailBroadcastLog.countDocuments({}),
      EmailBroadcastLog.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "sentBy", model: "Users", select: "firstName lastName email" })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error in getEmailBroadcastHistory:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getUsersDataForAdmin,
  getJobDataForAdmin,
  getJobApplicationsAdmin,
  getJobApplicationForAdminUserWise,
  registerClient,
  getJobApplicationsForAdmin,
  getBroadcastAudienceCounts,
  searchUsersForPush,
  sendAdminPushNotification,
  getBroadcastHistory,
  getBroadcastEmailAudienceCounts,
  sendAdminEmailBroadcast,
  getEmailBroadcastHistory,
};
