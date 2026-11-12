const cron = require("node-cron");
const moment = require("moment");
const JobsApplications = require("../models/jobsApplicationModel");
const Users = require("../models/userModel");
const { dateDifference } = require("../helpers/helper");
const { USER_TYPES } = require("../constants/constants");

// Schedule a daily job to check and update the 'alloted' field based on 'contractDate'
cron.schedule("0 0 * * *", async () => {
  try {
    const today = moment().startOf("day"); // Get today's date
    console.log(today, "todaysyssysysyys");
    // Find all job applications where the contractDate is a past date (already expired)
    const applications = await JobsApplications.find({});

    for (const app of applications) {
      const userData = await Users.findOne({ _id: app?.companyId });
      const dateDiff = await dateDifference(userData?.createdAt);
      console.log(Number(app?.contractDate), app?.companyId);
      console.log(
        dateDiff === Number(app?.contractDate),
        "dateDiff === Number(app?.contractDate)"
      );
      if (
        dateDiff === Number(app?.contractDate) &&
        app.status === "ONBOARDED" &&
        userData?.userType === USER_TYPES.PERSONAL
      ) {
        await Users.findByIdAndUpdate(app.companyId, {
          $set: { alloted: false },
        });

        console.log(
          `Updated 'alloted' status for user with companyId: ${app.companyId}`
        );
      }
    }
  } catch (error) {
    console.error("Error updating 'alloted' field:", error);
  }
});
