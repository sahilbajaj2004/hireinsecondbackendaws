const OnboardingMaster = require("../models/OnboardingModel");

const acceptOnboarding = async (req, res) => {
  const { onboadingDetails, notice, applicationId } = req.body;
  const cliendId = req.body.cliendId || req.body.clientId;

  try {
    const checkRecord = await OnboardingMaster.findOne({
      applicationId: applicationId,
    });
    if (checkRecord) {
      res.status(500).json({
        success: false,
        message: "Request Already exists",
      });
    } else {
      const data = await OnboardingMaster.create({
        onboadingDetails,
        cliendId,
        notice,
        applicationId,
        status: "ACTIVE",
      });
      if (data) {
        res.status(200).json({
          success: true,
          message: "Successfully Submitted Request will be back to you soon",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Something went wrong",
        });
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error,
    });
  }
};
module.exports = {
  acceptOnboarding,
};
