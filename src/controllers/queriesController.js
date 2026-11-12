const QueriesModel = require("../models/QueriesModel");

const addQueries = async (req, res) => {
  const { jobType, budget, noOfDays, skills, currency, location } = req.body;
  try {
    await QueriesModel.create({
      jobType,
      budget,
      noOfDays,
      skills,
      currency,
      location,
    });
    res.status(200).json({
      message: "Added Queries",
      success: true,
      whatsAppStatus: false,
    });
  } catch (error) {
    // Validation/DB errors must not escape as unhandled rejections - that
    // kills the whole Node process (the await used to run outside try).
    res.status(400).json({ success: false, message: error?.message || "Query failed" });
  }
};
module.exports = { addQueries };
