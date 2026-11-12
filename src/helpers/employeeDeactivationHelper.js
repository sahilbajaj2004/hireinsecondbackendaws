const mongoose = require("mongoose");
const JobsApplications = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const JobsInterview = require("../models/mettingModel");

/**
 * Handles side effects when an employee is deactivated.
 * Sets isActive = false for applications and interviews.
 * @param {string} employeeId - The ID of the employee being deactivated.
 */
const handleEmployeeDeactivation = async (employeeId) => {
    try {
        console.log(`Starting deactivation side effects for employee: ${employeeId}`);

        // Find relevant applications (active ones)
        // We only care about applications that are currently "valid" (not revoked/rejected)
        // or just all of them? If an app is REVOKED, setting isActive=false doesn't hurt.
        // But for statistics, we only decrement if it WAS counting towards the stats.
        // The stats (applicationsCount) usually count all non-rejected/revoked apps.
        const applications = await JobsApplications.find({
            employeeId: employeeId,
            isActive: true, // Only deactivate active ones
        });

        console.log(`Found ${applications.length} applications to soft-deactivate.`);

        for (const app of applications) {
            app.isActive = false;
            await app.save();

            // Update Job Statistics
            const job = await Jobs.findById(app.jobId);
            if (job) {
                if (job.applicationsCount > 0) {
                    job.applicationsCount -= 1;
                }

                // Recalculate lastApplicationAt
                const latestApp = await JobsApplications.findOne({
                    jobId: app.jobId,
                    isActive: true, // only active ones count
                }).sort({ sentAt: -1 });

                job.lastApplicationAt = latestApp ? latestApp.sentAt : null;
                await job.save();
            }

            // Handle Interviews
            const interviews = await JobsInterview.find({
                applicationId: app._id.toString(),
                isActive: true,
            });

            for (const interview of interviews) {
                interview.isActive = false;
                await interview.save();

                // Update Job Interview Statistics
                const jobForInterview = await Jobs.findById(app.jobId);
                if (jobForInterview) {
                    if (jobForInterview.interviewCount > 0) {
                        jobForInterview.interviewCount -= 1;
                    }

                    // Recalculate lastInterviewAt
                    const latestInterview = await JobsInterview.findOne({
                        jobId: app.jobId,
                        isActive: true,
                    }).sort({ createdAt: -1 });

                    jobForInterview.lastInterviewAt = latestInterview ? latestInterview.createdAt : null;
                    await jobForInterview.save();
                }
            }
        }
        console.log(`Deactivation side effects completed for employee: ${employeeId}`);
    } catch (error) {
        console.error("Error in handleEmployeeDeactivation:", error);
    }
};

/**
 * Handles side effects when an employee is reactivated.
 * Sets isActive = true for applications and interviews.
 * @param {string} employeeId - The ID of the employee being reactivated.
 */
const handleEmployeeReactivation = async (employeeId) => {
    try {
        console.log(`Starting reactivation side effects for employee: ${employeeId}`);

        // Find applications that were deactivated (isActive: false)
        // We should probably only reactivate those that match this employee.
        // NOTE: This assumes ALL their inactive apps should be reactivated. 
        // If they had apps that were inactive for proper reasons (e.g. deleted), this might revive them.
        // But since we just added isActive, and default is true, false likely means "deactivated via employee deactivation".
        // To be safer, we could have used a specific flag or just assume this behavior is desired.
        // User said: "toggle the isActive status".
        const applications = await JobsApplications.find({
            employeeId: employeeId,
            isActive: false,
            // We only reactivate if the underlying status is still "valid"
            status: { $nin: ["REVOKED", "NOT_ACTIVE", "REJECTED"] }
        });

        console.log(`Found ${applications.length} applications to reactivate.`);

        for (const app of applications) {
            app.isActive = true;
            await app.save();

            // Update Job Statistics
            const job = await Jobs.findById(app.jobId);
            if (job) {
                job.applicationsCount += 1;

                // Recalculate lastApplicationAt (include the just-activated one)
                const latestApp = await JobsApplications.findOne({
                    jobId: app.jobId,
                    isActive: true,
                    status: { $nin: ["REVOKED", "NOT_ACTIVE", "REJECTED"] }
                }).sort({ sentAt: -1 });

                job.lastApplicationAt = latestApp ? latestApp.sentAt : null;
                await job.save();
            }

            // Handle Interviews
            const interviews = await JobsInterview.find({
                applicationId: app._id.toString(),
                isActive: false,
                status: { $nin: ["CANCELLED", "NOT_ACTIVE"] }
            });

            for (const interview of interviews) {
                interview.isActive = true;
                await interview.save();

                // Update Job Interview Statistics
                const jobForInterview = await Jobs.findById(app.jobId);
                if (jobForInterview) {
                    jobForInterview.interviewCount += 1;

                    // Recalculate lastInterviewAt
                    const latestInterview = await JobsInterview.findOne({
                        jobId: app.jobId,
                        isActive: true,
                        status: { $nin: ["CANCELLED", "NOT_ACTIVE"] }
                    }).sort({ createdAt: -1 });

                    jobForInterview.lastInterviewAt = latestInterview ? latestInterview.createdAt : null;
                    await jobForInterview.save();
                }
            }
        }
        console.log(`Reactivation side effects completed for employee: ${employeeId}`);
    } catch (error) {
        console.error("Error in handleEmployeeReactivation:", error);
    }
};

module.exports = { handleEmployeeDeactivation, handleEmployeeReactivation };
