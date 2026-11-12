const EmployeeOnboarding = require("../models/employeeModel");
const JobsApplications = require("../models/jobsApplicationModel");
const { handleEmployeeDeactivation, handleEmployeeReactivation } = require("../helpers/employeeDeactivationHelper");

const addEmployee = async (req, res) => {
  try {
    const {
      companyId,
      name,
      skills,
      exprience,
      joiningEstimate,
      budget,
      resume,
      paymentType,
      currency,
      profilePic,
    } = req.body;
    const userObj = await EmployeeOnboarding.create({
      companyId,
      name,
      skills,
      exprience,
      joiningEstimate,
      budget,
      resume,
      paymentType,
      currency,
      profilePic,
      status: "ACTIVE",
    });
    if (userObj) {
      let response = {};
      res.status(200).json({
        success: true,
        message: "User added successfully",
      });
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const getEmployees = async (req, res) => {
  const companyId = req.query.companyId;
  const pageId = parseInt(req.query.pageId) || 1;
  const limit = parseInt(req.query.limit) || 22;
  const jobId = req.query.jobId;

  // Filters
  const {
    name,
    skills,
    experience,
    joiningEstimate,
    budget,
    paymentType,
    status,
    isApplication,
    isInterview
  } = req.query;

  try {
    if (!companyId || companyId === "") {
      return res.status(400).json({
        success: false,
        message: "Bad Request: Company ID is required",
      });
    }

    const query = { companyId };

    if (status) {
      if (status !== "all") {
        query.status = status;
      }
    } else {
      query.status = "ACTIVE";
    }

    if (name) {
      query.name = { $regex: name, $options: "i" };
    }
    if (skills) {
      query.skills = { $regex: skills, $options: "i" };
    }
    if (experience) {
      if (typeof experience === "object") {
        query.exprience = {};
        if (experience.min) query.exprience.$gte = experience.min;
        if (experience.max) query.exprience.$lte = experience.max;
      } else {
        query.exprience = { $regex: experience, $options: "i" };
      }
    }
    if (joiningEstimate) {
      query.joiningEstimate = { $regex: joiningEstimate, $options: "i" };
    }
    if (budget) {
      if (typeof budget === "object") {
        query.budget = {};
        if (budget.min) query.budget.$gte = budget.min;
        if (budget.max) query.budget.$lte = budget.max;
      } else {
        query.budget = { $regex: budget, $options: "i" };
      }
    }
    if (paymentType) {
      query.paymentType = { $regex: paymentType, $options: "i" };
    }

    // isApplication Filter
    if (isApplication === "true" || isApplication === true) {
      query.applicationCount = { $gt: 0 };
    }

    // isInterview Filter
    if (isInterview === "true" || isInterview === true) {
      query.interviewCount = { $gt: 0 };
    }

    const skip = (pageId - 1) * limit;

    // Fetch employees with filters, pagination, and sorting
    // Using collation for correct string-number comparison
    const sortOptions = {};
    if (req.query.sortBy === "lastApplicationAt") {
      sortOptions.lastApplicationAt = -1;
    } else if (req.query.sortBy === "lastInterviewAt") {
      sortOptions.lastInterviewAt = -1;
    } else {
      sortOptions.createdAt = -1;
    }

    let employeeList = await EmployeeOnboarding.find(query)
      .collation({ locale: "en", numericOrdering: true })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // If jobId is provided, check if employees have applied
    let appliedEmployeeIds = new Set();
    if (jobId) {
      const appliedEmployees = await JobsApplications.find({ jobId }).select(
        "employeeId"
      );
      appliedEmployeeIds = new Set(
        appliedEmployees.map((app) => app.employeeId)
      );
    }

    // Add isApplied: true/false based on whether the employee has applied
    // This also ensures we return plain objects instead of Mongoose documents
    employeeList = employeeList.map((employee) => ({
      ...employee.toObject(),
      isApplied: appliedEmployeeIds.has(employee._id.toString()),
    }));

    // Get total count for pagination metadata (optional but good practice)
    const totalEmployees = await EmployeeOnboarding.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: employeeList,
      pagination: {
        total: totalEmployees,
        page: pageId,
        limit: limit,
        totalPages: Math.ceil(totalEmployees / limit),
      },
    });
  } catch (error) {
    console.error("Error in getEmployees:", error);
    res.status(500).json({ success: false, error });
  }
};

module.exports = getEmployees;

const updateEmployee = async (req, res) => {
  const body = req.body;
  console.log(body);
  if (body && body._id) {
    const employee = await EmployeeOnboarding.findById({ _id: body._id });
    employee.companyId = body.companyId;
    employee.name = body.name;
    employee.status = body.status ?? employee.status;
    employee.skills = body.skills;
    employee.exprience = body.exprience;
    employee.joiningEstimate = body.joiningEstimate;
    employee.budget = body.budget;
    employee.resume = body.resume;
    employee.paymentType = body.paymentType ?? employee.paymentType;
    employee.currency = body.currency ?? employee.currency;
    employee.profilePic = body.profilePic ?? employee.profilePic;

    const userObj = await employee.save();
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

const updateEmployeeStatus = async (req, res) => {
  try {
    const { _id, ...updateData } = req.body;
    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }
    // Revised V2 implementation:
    const employee = await EmployeeOnboarding.findById(_id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (employee.status === "ACTIVE" && updateData.status === "NOT_ACTIVE") {
      await handleEmployeeDeactivation(_id);
    } else if (employee.status === "NOT_ACTIVE" && updateData.status === "ACTIVE") {
      await handleEmployeeReactivation(_id);
    }

    const updatedEmployee = await EmployeeOnboarding.findByIdAndUpdate(
      _id,
      updateData,
      { new: true, runValidators: true }
    );
    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Error in updateEmployeeStatus:", error);
    res.status(500).json({ success: false, error });
  }
};

const getAdminEmployees = async (req, res) => {
  try {
    const allemployee = await EmployeeOnboarding.find();
    res.status(200).json({
      success: true,
      message: "Successfully Updated",
      data: allemployee,
    });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const deactivateEmployee = async (req, res) => {
  try {
    const { newStatus, id } = req.body;
    const employee = await EmployeeOnboarding.findOne({ _id: id });
    console.log(employee);
    if (employee) {
      if (employee.status === "ACTIVE" && newStatus === "NOT_ACTIVE") {
        await handleEmployeeDeactivation(id);
      } else if (employee.status === "NOT_ACTIVE" && newStatus === "ACTIVE") {
        await handleEmployeeReactivation(id);
      }
      employee.status = newStatus;
      await employee.save();
      res.status(200).json({
        success: true,
        message: "Successfully Updated",
        data: employee,
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

const getEmployeeById = async (req, res) => {
  const employeeId = req.params.id;
  try {
    const data = await EmployeeOnboarding.findById(employeeId);
    if (data) {
      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: data,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Employee not found",
      });
    }
  } catch (error) {
    // Bad/missing ObjectId must answer 400, not leave the request hanging
    // (the rejected await was previously outside try).
    return res.status(400).json({
      success: false,
      message: error?.message || "Failed to fetch employee",
    });
  }
};

module.exports = {
  addEmployee,
  getEmployees,
  updateEmployee,
  getAdminEmployees,
  deactivateEmployee,
  getEmployeeById,
  updateEmployeeStatus
};
