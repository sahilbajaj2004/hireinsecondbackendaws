const AggreementQuerises = require("../models/AggrementModel");

const addAggrement = async (req, res) => {
  const { applicationId, resourceId, document } = req.body;
  try {
    const data = await AggreementQuerises.create({
      applicationId,
      resourceId,
      document,
    });
    if (data) {
      res.status(200).json({ success: true });
    } else {
      res.status(200).json({ success: false });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

const getAggrement = async (req, res) => {
  const applicationId = req.query.applicationId;
  const resourceId = req.query.resourceId;
  try {
    const data = await AggreementQuerises.findOne({
      applicationId: applicationId,
      resourceId: resourceId,
    });
    if (data) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(200).json({ success: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
module.exports = { addAggrement, getAggrement };
