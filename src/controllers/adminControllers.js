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
module.exports = {
  getUsersDataForAdmin,
  getJobDataForAdmin,
  getJobApplicationsAdmin,
  getJobApplicationForAdminUserWise,
  registerClient,
  getJobApplicationsForAdmin
};
