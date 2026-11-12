const { google } = require("googleapis");
const JobsInterview = require("../models/mettingModel");
const { response } = require("express");
const fetch = require("node-fetch");
const { sendEmail } = require("../functions/utils");
const Jobs = require("../models/jobsModel");
const Users = require("../models/userModel");
const { USER_TYPES } = require("../constants/constants");
const { getJobslist, getVendorlist } = require("./jobsApplicationsController");
const Notifications = require("../models/notificatonModel");
const ReSheduleInterview = require("../models/reSheduleModel");
const moment = require("moment");
const JobsApplications = require("../models/jobsApplicationModel");
const EmployeeOnboarding = require("../models/employeeModel");
const InviteEmployee = require("../models/employeeInvite");

require("dotenv").config();
const getZoomApiToken = async () => {
  const url =
    "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=DQkbcWRvRqau7VDzl23KJQ";

  const requestOptions = {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization:
        "Basic " + btoa("9xagtshXTiq7BAFVyXw:nIY920U78isblXa5S5G6MP905zNCt0b3"),
    },
  };

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) throw new Error("Failed to get Zoom API token");
    const data = await response.json();
    return `Bearer ${data.access_token}`;
  } catch (error) {
    console.error("Error fetching Zoom API token:", error);
    return false;
  }
};
const zoomMeetingCreateUrl = "https://api.zoom.us/v2/users/me/meetings";
const zoomMeetingUpdateeUrl = "https://api.zoom.us/v2/meetings";

// const calendarId = process.env.CALENDAR_ID;
const addInterview = async (req, res) => {
  const {
    clientId,
    jobId,
    employeeId,
    meetingStartTime,
    meetingEndTime,
    assignee,
    description,
    title,
    applicationId,
    password,
    timezone,
    duration,
    meetingLink,
    meetingPlatform,
    settings,
  } = req.body;

  try {
    let resolvedEmployeeId = employeeId;
    let resolvedJobId = jobId;
    if (applicationId) {
      const applicationDoc = await JobsApplications.findById(applicationId);
      if (applicationDoc) {
        if (!resolvedEmployeeId || resolvedEmployeeId === clientId) {
          resolvedEmployeeId = applicationDoc.employeeId || applicationDoc.companyId;
        }
        if (!resolvedJobId || resolvedJobId === "general-requisition") {
          resolvedJobId = applicationDoc.jobId;
        }
      }
    }

    const durationMinutes = parseInt(String(duration || 45).replace(/[^\d]/g, ""), 10) || 45;
    const meetingPassword = password || Math.floor(100000 + Math.random() * 900000).toString();
    const meetingTimezone = timezone || "Asia/Kolkata";
    const isGoogleMeet =
      meetingPlatform === "google_meet" ||
      (typeof meetingLink === "string" && meetingLink.includes("meet.google.com"));

    let zoomData = null;
    if (!isGoogleMeet) {
      try {
        const zoomApiToken = await getZoomApiToken();
        if (zoomApiToken) {
          const requestOptions = {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: zoomApiToken,
            },
            body: JSON.stringify({
              topic: title || "Interview",
              type: 2,
              start_time: meetingStartTime,
              duration: durationMinutes,
              timezone: meetingTimezone,
              password: meetingPassword,
              agenda: description || title,
              settings: {
                ...settings,
                join_before_host: true,
                jbh_time: 0,
                waiting_room: false,
                meeting_authentication: false,
                enforce_login: false,
                approval_type: 2,
                participant_video: true,
                host_video: true,
                mute_upon_entry: false,
                use_pmi: false,
              },
            }),
          };
          const zoomResponse = await fetch(zoomMeetingCreateUrl, requestOptions);
          if (zoomResponse && zoomResponse.ok) {
            zoomData = await zoomResponse.json();
          } else if (zoomResponse) {
            const errText = await zoomResponse.text().catch(() => "");
            console.warn("Zoom meeting creation API response:", zoomResponse.status, errText);
          }
        }
      } catch (e) {
        console.warn("Zoom meeting creation fallback:", e.message);
      }
    }

    const fallbackRoomId = "his-" + Math.random().toString(36).substring(2, 6) + "-" + Math.random().toString(36).substring(2, 6);
    // If Google Meet, use provided link. If Zoom, use zoomData.join_url. Otherwise fallback to reliable Jitsi video room.
    const resolvedLink =
      (isGoogleMeet && meetingLink)
        ? meetingLink.trim()
        : zoomData?.join_url || meetingLink || `https://meet.jit.si/hireinsecond-interview-${fallbackRoomId}`;

    const jobTitle = await Jobs.findOne({ _id: resolvedJobId });
    const users = await Users.findOne({ _id: resolvedEmployeeId });
    const client = await Users.findOne({ _id: clientId });
    let isVendor = false;
    if (users === null) {
      isVendor = true;
    }
    const insertData = await JobsInterview.create({
      clientId,
      jobId: resolvedJobId,
      employeeId: resolvedEmployeeId,
      meetingStartTime,
      meetingEndTime,
      assignee,
      description,
      title,
      applicationId,
      password: zoomData?.password || meetingPassword,
      timezone: zoomData?.timezone || meetingTimezone,
      duration: `${durationMinutes}m`,
      meetingLink: resolvedLink,
      joinUrl: resolvedLink,
      startUrl: zoomData?.start_url || resolvedLink,
      interviewers: zoomData?.settings?.meeting_invitees
        ? JSON.stringify(zoomData.settings.meeting_invitees)
        : (typeof assignee === "string" ? assignee : JSON.stringify(assignee || [])),
      candidate: users?.email || (users?.firstName ? `${users.firstName} ${users.lastName || ""}`.trim() : "Candidate"),
      meetingId: zoomData?.id ? String(zoomData.id) : fallbackRoomId,
    });

    let updateJobApplication = null;
    if (applicationId) {
      updateJobApplication = await JobsApplications.findOneAndUpdate(
        { _id: applicationId },
        { $inc: { interviewCount: 1 }, lastInterviewAt: Date.now() }
      );
    }

    let updateJob = null;
    if (jobId) {
      updateJob = await Jobs.findOneAndUpdate(
        { _id: jobId },
        { $inc: { interviewCount: 1 }, lastInterviewAt: Date.now() }
      );
    }

    let updateEmployee = null;
    if (isVendor && employeeId) {
      updateEmployee = await EmployeeOnboarding.findOneAndUpdate(
        { _id: employeeId },
        { $inc: { interviewCount: 1 }, lastInterviewAt: Date.now() }
      );
    }

    if (!insertData) {
      return res.status(200).json({
        success: false,
        message: "Failed to insert interview data",
      });
    }

    if (applicationId && !updateJobApplication) {
      console.warn("Application ID provided but not found for interview update:", applicationId);
    }

    let payload = {};
    if (users && users?.userType === USER_TYPES.PERSONAL) {
      payload = {
        subject: `Interview Invitation – ${jobTitle?.jobTitle} Position`,
        emailbody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interview Invitation – ${jobTitle?.jobTitle} Position</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    width: 80%;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                .header {
                    text-align: center;
                    padding-bottom: 20px;
                }
                .content {
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    color: #fff;
                    background-color: #007bff;
                    text-decoration: none;
                    border-radius: 5px;
                }
                .footer {
                    text-align: center;
                    font-size: 0.9em;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Interview Invitation – ${jobTitle?.jobTitle
          } Position</h2>
                </div>
                <div class="content">
                    <p>Hello ${users?.firstName} ${users?.lastName},</p>
                    <p>We are pleased to inform you that you have been shortlisted for an interview for the ${jobTitle?.jobTitle
          } position at ${client?.companyName
          }. We would like to schedule a Zoom interview with you at your earliest convenience.</p>
                    
                    <p>Please find the details below:</p>
                    <ul>
                        <li><strong>Date:</strong> ${moment(
            meetingStartTime
          ).format("DD MMM YY, LT")}</li>
                        <li><strong>Duration:</strong> ${duration}</li>
                    </ul>
                    <p>To join the Zoom meeting, please click the link below:</p>

                    
                    <p><a href=${zoomData?.join_url
          } class="button">Join Zoom Meeting</a></p>


                    <p>If the link does not work, you can use the following details to join manually:</p>
                    <ul>
                        <li><strong>Meeting ID:</strong> ${zoomData?.id}</li>
                        <li><strong>Passcode:</strong>${zoomData?.password}</li>
                    </ul>
                    <tr>
                    <td>
                    <a href=${process.env.INVITE_LINK + applicationId
          } class="type="button" style="background-color:green; color:white; padding:15px 97px; outline: none; display: block; margin: auto; border-radius: 31px;
                    font-weight: bold;text-align:center; margin-left:20px;margin-right:20px; margin-top: 25px; margin-bottom: 25px; border: none; text-transform:uppercase">Accept Interview</a>
                    </td>
                  </tr>


                    <p>If the proposed time is not convenient for you, please let us know your availability so that we can reschedule.</p>
                    <tr>
                    <td>
                    <a href=${process.env.INVITE_LINK + applicationId
          } class="type="button" style="background-color:blue; color:white; padding:15px 97px; outline: none; display: block; margin: auto; border-radius: 31px;
                    font-weight: bold;text-align:center; margin-left:20px;margin-right:20px; margin-top: 25px; margin-bottom: 25px; border: none; text-transform:uppercase">Re-Schedule Interview</a>
                    </td>
                  </tr>
                    <p>We look forward to speaking with you.</p>
                    <p>Best regards,</p>
                    <p>Hire In Second Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent to ${users?.email
          }. If you have any questions, please contact us at support@hireinsecond.com.</p>
                </div>
            </div>
        </body>
        </html>
        `,
        bodyType: "html",
        toEmail: users?.email,
      };
    } else {
      const applicationsData = await JobsApplications.findById(applicationId);
      const employee = await EmployeeOnboarding.findById(
        applicationsData?.employeeId
      );
      payload = {
        subject: `Interview Invitation for Bench Candidate – ${employee?.name}`,
        emailbody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interview Invitation for Bench Candidate – ${employee?.name
          }</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    width: 80%;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                .header {
                    text-align: center;
                    padding-bottom: 20px;
                }
                .content {
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    color: #fff;
                    background-color: #007bff;
                    text-decoration: none;
                    border-radius: 5px;
                }
                .footer {
                    text-align: center;
                    font-size: 0.9em;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Interview Invitation for Bench Candidate – ${employee?.name
          }</h2>
                </div>
                <div class="content">
                    <p>Hello ${users?.firstName} ${users?.lastName},</p>
                    <p>We are pleased to inform you that your bench candidate, ${employee?.name
          }, has been shortlisted for an interview for the ${jobTitle?.jobTitle
          } position at ${users?.companyName
          }. We would like to schedule a Zoom interview at the earliest convenience.</p>
                    
                    <p>Please find the details below:</p>
                    <ul>
                        <li><strong>Date:</strong> ${moment(
            meetingStartTime
          ).format("DD MMM YY, LT")}</li>
                        <li><strong>Duration:</strong> ${duration}</li>
                    </ul>
                    <p>To join the Zoom meeting, please click the link below:</p>

                    
                    <p><a href=${zoomData?.join_url
          } class="button">Join Zoom Meeting</a></p>


                    <p>If the link does not work, you can use the following details to join manually:</p>
                    <ul>
                        <li><strong>Meeting ID:</strong> ${zoomData?.id}</li>
                        <li><strong>Passcode:</strong>${zoomData?.password}</li>
                    </ul>
                    <tr>
                    <td>
                    <a href=${process.env.INVITE_LINK + applicationId
          } class="type="button" style="background-color:green; color:white; padding:15px 97px; outline: none; display: block; margin: auto; border-radius: 31px;
                    font-weight: bold;text-align:center; margin-left:20px;margin-right:20px; margin-top: 25px; margin-bottom: 25px; border: none; text-transform:uppercase">Accept Interview</a>
                    </td>
                  </tr>


                    <p>If the proposed time is not convenient for you, please let us know your availability so that we can reschedule.</p>
                    <tr>
                    <td>
                    <a href=${process.env.INVITE_LINK + applicationId
          } class="type="button" style="background-color:blue; color:white; padding:15px 97px; outline: none; display: block; margin: auto; border-radius: 31px;
                    font-weight: bold;text-align:center; margin-left:20px;margin-right:20px; margin-top: 25px; margin-bottom: 25px; border: none; text-transform:uppercase">Re-Schedule Interview</a>
                    </td>
                  </tr>
                    <p>We look forward to speaking with you.</p>
                    <p>Best regards,</p>
                    <p>Hire In Second Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent to ${users?.email
          }. If you have any questions, please contact us at support@hireinsecond.com.</p>
                </div>
            </div>
        </body>
        </html>
        `,
        bodyType: "html",
        toEmail: users?.email,
      };
    }

    await sendEmail(payload);
    const notifications = await Notifications.create({
      userId: users?._id,
      type: "JobApplication",
      notificationDetail: insertData?.applicationId,
      title: title,
      details: `We are pleased to inform you that you have been shortlisted for an interview for the ${jobTitle?.jobTitle} position at ${client?.companyName}. We would like to schedule a Zoom interview with you at your earliest convenience.`,
    });
    res.status(200).json({
      success: true,
      message: "Successfully scheduled",
      data: zoomData,
    });
    zoomData?.settings?.meeting_invitees.forEach(async (e) => {
      const payload2 = {
        subject: `Request to Conduct Interview for ${users?.firstName} ${users?.lastName}`,
        emailbody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Zoom Interview Invitation</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    width: 80%;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                .header {
                    text-align: center;
                    padding-bottom: 20px;
                }
                .content {
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    color: #fff;
                    background-color: #007bff;
                    text-decoration: none;
                    border-radius: 5px;
                }
                .footer {
                    text-align: center;
                    font-size: 0.9em;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Request to Conduct Interview for ${users?.firstName} ${users?.lastName
          }</h2>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>I hope this message finds you well.</p>
                    <p>We have a candidate, ${users?.firstName} ${users?.lastName
          }, who has applied for the  ${jobTitle?.jobTitle
          }.Based on their resume, we believe they could be a strong fit for our team</p>

                    <p>Please find the details below:</p>
                    <ul>
                        <li><strong>Date:</strong> ${moment(
            meetingStartTime
          ).format("DD MMM YY, LT")}</li>
                        <li><strong>Duration:</strong> ${duration}</li>
                    </ul>
                    <p>To join the Zoom meeting, please click the link below:</p>
                    <p><a href=${zoomData?.join_url
          } class="button">Join Zoom Meeting</a></p>
                    <p>If the link does not work, you can use the following details to join manually:</p>
                    <ul>
                        <li><strong>Meeting ID:</strong> ${zoomData?.id}</li>
                        <li><strong>Passcode:</strong>${zoomData?.password}</li>
                    </ul>
                    <p>If the proposed time is not convenient for you, please let us know your availability so that we can reschedule.</p>
                    <p>We look forward to your feedback.</p>


                    <p>Request raised by</p>
                    <p>${client?.firstName} ${client?.lastName}<br>
                       ${client?.email}</p>
                </div>
                <div class="footer">
                    <p>This email was sent to ${e?.email
          }. If you have any questions, please contact us at support@hireinsecond.com.</p>
                </div>
            </div>
        </body>
        </html>
        `,
        bodyType: "html",
        toEmail: e?.email,
      };
      console.log(payload2);
      await sendEmail(payload2);
    });
  } catch (error) {
    console.error("Error in scheduling interview:", error);
    res.status(500).json({ success: false, error });
  }
};

const getInterviewList = async (req, res) => {
  const { id, jobId, clientId, type, employeeId, applicationId } = req.query;

  let interview;
  try {
    switch (type) {
      case "client":
        const clientFilter = { clientId: clientId || req.user?._id };
        if (id) clientFilter.applicationId = id;
        if (jobId) clientFilter.jobId = jobId;
        interview = await JobsInterview.find(clientFilter).sort({ meetingStartTime: 1 });
        break;
      case "job":
        interview = await JobsInterview.find({ jobId: id });
        break;
      case "allList":
        interview = await JobsInterview.find({ employeeId: id });
        break;
      case "interview":
        interview = await JobsInterview.findOne({ _id: id });
        break;
      case "application":
        interview = await JobsInterview.findOne({
          applicationId: id,
        });
        break;
      case "clientIterview":
        interview = await JobsInterview.find({
          applicationId: id,
          jobId: jobId,
          clientId: clientId,
          employeeId: employeeId,
        });
        break;
      case "vendor": {
        const vendorId = id || req.user?._id;
        if (vendorId) {
          if (applicationId) {
            interview = await JobsInterview.find({ applicationId });
          } else if (employeeId) {
            interview = await JobsInterview.find({ employeeId });
          } else {
            const [vendorApps, vendorEmps] = await Promise.all([
              JobsApplications.find({ companyId: vendorId }).select("_id"),
              EmployeeOnboarding.find({ companyId: vendorId }).select("_id"),
            ]);
            const appIds = vendorApps.map((a) => a._id.toString());
            const empIds = vendorEmps.map((e) => e._id.toString());

            const orConditions = [];
            if (appIds.length > 0) orConditions.push({ applicationId: { $in: appIds } });
            if (empIds.length > 0) orConditions.push({ employeeId: { $in: empIds } });
            orConditions.push({ employeeId: vendorId });
            orConditions.push({ clientId: vendorId });

            interview = await JobsInterview.find({ $or: orConditions }).sort({ meetingStartTime: 1 });
          }
        } else {
          interview = [];
        }
        break;
      }
      default:
        if (req.user?.userType === "client") {
          const defaultClientFilter = { clientId: req.user._id };
          if (id) defaultClientFilter.applicationId = id;
          if (jobId) defaultClientFilter.jobId = jobId;
          interview = await JobsInterview.find(defaultClientFilter).sort({ meetingStartTime: 1 });
        } else if (
          req.user?.userType === USER_TYPES.COMPANY ||
          req.user?.userType === USER_TYPES.INDIVIDUAL ||
          req.user?.userType === "company" ||
          req.user?.userType === "individual"
        ) {
          const vendorId = req.user._id;
          const [vendorApps, vendorEmps] = await Promise.all([
            JobsApplications.find({ companyId: vendorId }).select("_id"),
            EmployeeOnboarding.find({ companyId: vendorId }).select("_id"),
          ]);
          const appIds = vendorApps.map((a) => a._id.toString());
          const empIds = vendorEmps.map((e) => e._id.toString());

          const orConditions = [];
          if (appIds.length > 0) orConditions.push({ applicationId: { $in: appIds } });
          if (empIds.length > 0) orConditions.push({ employeeId: { $in: empIds } });
          orConditions.push({ employeeId: vendorId });
          orConditions.push({ clientId: vendorId });

          interview = await JobsInterview.find({ $or: orConditions }).sort({ meetingStartTime: 1 });
        }
        break;
    }

    if (interview) {
      const interviewList = Array.isArray(interview) ? interview : [interview];
      let arr = [];
      await Promise.all(
        interviewList.map(async (doc) => {
          const element = doc?.toObject ? doc.toObject() : { ...doc };
          const data = await ReSheduleInterview.find({
            interviewId: element?._id,
          });
          const user = element?.clientId ? await Users.findById(element.clientId) : null;
          const newArr = data?.filter((i) => i.isAccepted === "N/A");
          if (newArr?.length > 0) {
            element.isPendingRequest = true;
          }
          const job = element?.jobId ? await Jobs.findById(element.jobId) : null;
          element.jobTitle = job?.jobTitle || element?.jobTitle || "Engineering Position";
          element.profilePic = user?.profilePic;
          element.clientName =
            user?.companyName ||
            user?.fullName ||
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            "Corporate Client";
          element.clientDetails = user;

          if (element?.employeeId) {
            const candidate = await Users.findById(element.employeeId);
            if (candidate) {
              element.candidateName =
                `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() ||
                candidate.fullName ||
                "Candidate";
              element.candidatePic = candidate.profilePic;
            } else {
              const benchCandidate = await EmployeeOnboarding.findById(element.employeeId);
              if (benchCandidate) {
                element.candidateName = benchCandidate.name || "Candidate";
                element.candidatePic = benchCandidate.profilePic;
              }
            }
          }

          // Ensure attendees never receive admin start_url (containing host zak token)
          if (element?.joinUrl) {
            if (!element.meetingLink || element.meetingLink.includes("/s/") || element.meetingLink.includes("zak=")) {
              element.meetingLink = element.joinUrl;
            }
          }

          arr.push(element);
        })
      );
      res.status(200).json({
        success: true,
        message: "Successfully Fetched",
        data: arr,
      });
    } else {
      res.status(200).json({
        success: true,
        message: "No data found",
        data: [],
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const getInterviewById = async (req, res) => {
  // The frontend may send the interview id either as a path param
  // (/getInterviewById/:id) or a query param (/getInterviewById?id=).
  const id = req.params.id || req.query.id;
  const userType = req.query.userType;
  console.log(id, "1");
  try {
    let obj = {};

    const data = await JobsInterview.findById(id);
    console.log(data, "1");
    obj.jobDetails = await getJobslist(data.jobId);
    console.log(obj, "1");
    if (
      userType === USER_TYPES.PERSONAL ||
      userType === USER_TYPES.INDIVIDUAL ||
      userType === USER_TYPES.COMPANY
    ) {
      obj.clientDetails = await getVendorlist(data.clientId);
    } else {
      let vendorInfo = await getVendorlist(data.employeeId);
      if (!vendorInfo?.firstName && !vendorInfo?.name) {
        const emp = await EmployeeOnboarding.findById(data.employeeId);
        if (emp) {
          vendorInfo = {
            ...vendorInfo,
            firstName: emp.name,
            lastName: "",
            name: emp.name,
            skills: emp.skills,
            profilePic: emp.profilePic || "",
          };
        }
      }
      obj.vendorDetails = vendorInfo;
    }
    console.log(obj, "2");
    if (data) {
      const interviewObj = data.toObject ? data.toObject() : { ...data };
      if (interviewObj?.joinUrl) {
        if (!interviewObj.meetingLink || interviewObj.meetingLink.includes("/s/") || interviewObj.meetingLink.includes("zak=")) {
          interviewObj.meetingLink = interviewObj.joinUrl;
        }
      }
      obj.interviewDetails = interviewObj;
    } else {
      obj.interviewDetails = data;
    }
    const queries = await ReSheduleInterview.find({ interviewId: data?._id });
    obj.reSheduleQueries = queries;
    const newArr = queries.filter((i) => i.isAccepted === "N/A");
    if (newArr?.length > 0) {
      obj.interviewDetails.isPendingRequest = true;
    }
    const application = await JobsApplications.findById(data?.applicationId);
    obj.jobApplicationStatus = application?.status;

    if (obj) {
      res.status(200).json({
        success: true,
        message: "Successfully Fetched",
        data: obj,
      });
    } else {
      res.status(200).json({
        success: false,
        message: "No data found",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const resheduleInterview = async (req, res) => {
  const {
    clientId,
    jobId,
    employeeId,
    meetingStartTime,
    description,
    applicationId,
    title,
    password,
    timezone,
    duration,
    settings,
    meetingId,
  } = req.body;
  try {
    const zoomApiToken = await getZoomApiToken();
    if (!zoomApiToken) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve Zoom API token",
      });
    }

    const durationMinutes = parseInt(String(duration || 45).replace(/[^\d]/g, ""), 10) || 45;
    const requestOptions = {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: zoomApiToken,
      },
      body: JSON.stringify({
        topic: title,
        type: 2,
        start_time: meetingStartTime,
        duration: durationMinutes,
        timezone: timezone || "Asia/Kolkata",
        password: password,
        agenda: description,
        settings: {
          ...settings,
          join_before_host: true,
          jbh_time: 0,
          waiting_room: false,
          meeting_authentication: false,
          enforce_login: false,
          approval_type: 2,
        },
      }),
    };
    console.log(settings, "settings");
    const zoomResponse = await fetch(
      zoomMeetingUpdateeUrl + "/" + meetingId,
      requestOptions
    );
    console.log(zoomMeetingUpdateeUrl + "/" + meetingId);
    if (zoomResponse) {
      const findData = await JobsInterview.findOne({ meetingId: meetingId });
      const jobTitle = await Jobs.findOne({ _id: jobId });
      const users = await Users.findOne({ _id: employeeId });
      const client = await Users.findOne({ _id: clientId });
      const requestOptions = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: zoomApiToken,
        },
      };
      console.log(settings, "settings");
      const zoomResponse = await fetch(
        zoomMeetingUpdateeUrl + "/" + meetingId,
        requestOptions
      );
      const zoomData = await zoomResponse.json();
      console.log(zoomData, "zoomData");
      if (findData) {
        findData.interviewers = JSON.stringify(settings.meeting_invitees);
        findData.meetingStartTime = meetingStartTime;
        findData.description = description;
        findData.title = title;
        findData.password = password;
        findData.timezone = timezone;
        findData.duration = duration;
        findData.isAccepted = "N/A";
        findData.interviewRejectedReason = "";

        await findData.save();
        const payload = {
          subject: title,
          emailbody: `<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Zoom Interview Updated Invitation</title>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      line-height: 1.6;
                      color: #333;
                  }
                  .container {
                      width: 80%;
                      margin: 0 auto;
                      padding: 20px;
                      background-color: #f9f9f9;
                      border: 1px solid #ddd;
                      border-radius: 8px;
                  }
                  .header {
                      text-align: center;
                      padding-bottom: 20px;
                  }
                  .content {
                      margin-bottom: 20px;
                  }
                  .button {
                      display: inline-block;
                      padding: 10px 20px;
                      color: #fff;
                      background-color: green;
                      text-decoration: none;
                      border-radius: 5px;
                  }
                  .footer {
                      text-align: center;
                      font-size: 0.9em;
                      color: #777;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <h2>${title}</h2>
                  </div>
                  <div class="content">
                      <p>Dear ${users?.firstName} ${users?.lastName},</p>
                      <p>Your interview has been rescheduled find details below : </p>
                      <p>We are pleased to inform you that you have been shortlisted for an interview for the ${jobTitle?.jobTitle
            } position at ${client?.companyName
            }. We would like to schedule a Zoom interview with you at your earliest convenience.</p>
                      <p>Please find the details below:</p>
                      <ul>
                          <li><strong>Updated Date:</strong> ${moment(
              meetingStartTime
            ).format("DD MMM YY, LT")}</li>
                          <li><strong>Updated Duration:</strong> ${duration}</li>
                      </ul>
                      <p>To join the Zoom meeting, please click the link below:</p>
                      <p><a href=${zoomData?.join_url
            } class="button">Join Zoom Meeting</a></p>
                      <p>If the link does not work, you can use the following details to join manually:</p>
                      <ul>
                          <li><strong>Meeting ID:</strong> ${zoomData?.id}</li>
                          <li><strong>Passcode:</strong>${zoomData?.password
            }</li>
                      </ul>
                      <p>If the proposed time is not convenient for you, please let us know your availability so that we can reschedule.</p>
                      <p>We look forward to speaking with you.</p>
                      <p>Best regards,</p>
                      <p>${client?.firstName} ${client?.lastName}<br>
                         ${jobTitle?.jobTitle}<br>
                         ${client?.email}</p>
                  </div>
                  <div class="footer">
                      <p>This email was sent to ${users?.email
            }. If you have any questions, please contact us at support@hireinsecond.com.</p>
                  </div>
              </div>
          </body>
          </html>
          `,
          bodyType: "html",
          toEmail: users?.email,
        };

        await sendEmail(payload);
        const notifications = await Notifications.create({
          userId: users?._id,
          type: "JobApplication",
          notificationDetail: findData?.applicationId,
          title: title,
          details: `Your interview for the ${jobTitle?.jobTitle} position at ${client?.companyName} has been rescheduled. We would like to schedule a updated Zoom interview with you at your earliest convenience.`,
        });
        res.status(200).json({
          success: true,
          message: "Successfully Reshedule",
        });
        settings?.meeting_invitees.forEach(async (e) => {
          const payload2 = {
            subject: `Request to Conduct Interview for ${users?.firstName} ${users?.lastName}`,
            emailbody: `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Updated Zoom Interview Invitation</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }
                    .container {
                        width: 80%;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f9f9f9;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                    }
                    .header {
                        text-align: center;
                        padding-bottom: 20px;
                    }
                    .content {
                        margin-bottom: 20px;
                    }
                    .button {
                        display: inline-block;
                        padding: 10px 20px;
                        color: #fff;
                        background-color: #007bff;
                        text-decoration: none;
                        border-radius: 5px;
                    }
                    .footer {
                        text-align: center;
                        font-size: 0.9em;
                        color: #777;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Request to Conduct Interview for ${users?.firstName
              } ${users?.lastName}</h2>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>I hope this message finds you well.</p>
                        <p>We have a candidate, ${users?.firstName} ${users?.lastName
              }, who has applied for the  ${jobTitle?.jobTitle
              }. Based on their resume, we believe they could be a strong fit for our team.</p>
                        <p>From your experience i think you are suitable to take his interview.</p>
      
                        <p>Please find the details below:</p>
                        <ul>
                            <li><strong>Updated Date:</strong>${moment(
                meetingStartTime
              ).format("DD MMM YY, LT")}</li>
                            <li><strong>Updated Duration:</strong> ${duration}</li>
                        </ul>
                        <p>To join the Zoom meeting, please click the link below:</p>
                        <p><a href=${zoomData?.join_url
              } class="button">Join Zoom Meeting</a></p>
                        <p>If the link does not work, you can use the following details to join manually:</p>
                        <ul>
                            <li><strong>Meeting ID:</strong> ${zoomData?.id
              }</li>
                            <li><strong>Passcode:</strong>${zoomData?.password
              }</li>
                        </ul>
                        <p>If the proposed time is not convenient for you, please let us know your availability so that we can reschedule.</p>
                        <p>We look forward to your feedback.</p>
                        <p>Best regards,</p>
                        <p>${client?.firstName} ${client?.lastName}<br>
                           ${client?.email}</p>
                    </div>
                    <div class="footer">
                        <p>This email was sent to ${e?.email
              }. If you have any questions, please contact us at support@hireinsecond.com.</p>
                    </div>
                </div>
            </body>
            </html>
            `,
            bodyType: "html",
            toEmail: e?.email,
          };
          console.log(payload2);
          await sendEmail(payload2);
        });
      } else {
        res.status(200).json({
          success: false,
          message: "Something went wrong",
        });
      }
    } else {
      res.status(200).json({
        success: false,
        message: "Something went wrong",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

const deleteInterview = async (req, res) => {
  const { meetingId, reason } = req.body;
  try {
    const zoomApiToken = await getZoomApiToken();

    const requestOptions = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: zoomApiToken,
      },
    };
    const zoomResponse = await fetch(
      zoomMeetingUpdateeUrl + "/" + meetingId,
      requestOptions
    );
    if (zoomResponse.ok) {
      const data = await JobsInterview.findOne({ meetingId: meetingId });

      if (data) {
        const jobTitle = await Jobs.findOne({ _id: data?.jobId });
        const users = await Users.findOne({ _id: data?.employeeId });
        const client = await Users.findOne({ _id: data?.clientId });
        data.status = "INACTIVE";
        data.reason = reason;
        await data.save();

        const payload = {
          subject: data?.title,
          emailbody: `<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Interview Cancelled</title>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      line-height: 1.6;
                      color: #333;
                  }
                  .container {
                      width: 80%;
                      margin: 0 auto;
                      padding: 20px;
                      background-color: #f9f9f9;
                      border: 1px solid #ddd;
                      border-radius: 8px;
                  }
                  .header {
                      text-align: center;
                      padding-bottom: 20px;
                  }
                  .content {
                      margin-bottom: 20px;
                  }
                  .button {
                      display: inline-block;
                      padding: 10px 20px;
                      color: #fff;
                      background-color: #007bff;
                      text-decoration: none;
                      border-radius: 5px;
                  }
                  .footer {
                      text-align: center;
                      font-size: 0.9em;
                      color: #777;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <h2>${data?.title}</h2>
                  </div>
                  <div class="content">
                      <p>Dear ${users?.firstName} ${users?.lastName},</p>
                      <p>Your interview has been cancelled. : </p>
                      <p>We are sorry to inform you that your interview for the ${jobTitle?.jobTitle} position at ${client?.companyName} has been cancelled. </p>
                      <p>Please find the reason below:</p>
                    
                      <p>${reason}</p>
                      <p>We look forward to speaking with you.</p>
                      <p>Best regards,</p>
                      <p>${client?.firstName} ${client?.lastName}<br>
                         ${jobTitle?.jobTitle}<br>
                         ${client?.email}</p>
                  </div>
                  <div class="footer">
                      <p>This email was sent to ${users?.email}. If you have any questions, please contact us at support@hireinsecond.com.</p>
                  </div>
              </div>
          </body>
          </html>
          `,
          bodyType: "html",
          toEmail: users?.email,
        };

        await sendEmail(payload);
        const notifications = await Notifications.create({
          userId: users?._id,
          type: "Interview",
          notificationDetail: data?._id,
          title: data?.title,
          details: `Your interview for the ${jobTitle?.jobTitle} position at ${client?.companyName} has been cancelled`,
        });
        res.status(200).json({
          success: true,
          message: "Successfully Cancelled",
        });

        JSON.parse(data?.interviewers).forEach(async (e) => {
          const payload2 = {
            subject: `Interview Cancelled::Request to Conduct Interview for ${users?.firstName} ${users?.lastName}`,
            emailbody: `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Interview Cancelled:: Zoom Interview Invitation</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }
                    .container {
                        width: 80%;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f9f9f9;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                    }
                    .header {
                        text-align: center;
                        padding-bottom: 20px;
                    }
                    .content {
                        margin-bottom: 20px;
                    }
                    .button {
                        display: inline-block;
                        padding: 10px 20px;
                        color: #fff;
                        background-color: #007bff;
                        text-decoration: none;
                        border-radius: 5px;
                    }
                    .footer {
                        text-align: center;
                        font-size: 0.9em;
                        color: #777;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Request to Conduct Interview for ${users?.firstName} ${users?.lastName}</h2>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>I hope this message finds you well.</p>
                        <p>Interview has been cancelled due to ${reason}</p>
                        <p>We look forward to speaking with you.</p>
                        <p>Best regards,</p>
                        <p>${client?.firstName} ${client?.lastName}<br>
                           ${client?.email}</p>
                    </div>
                    <div class="footer">
                        <p>This email was sent to ${e?.email}. If you have any questions, please contact us at support@hireinsecond.com.</p>
                    </div>
                </div>
            </body>
            </html>
            `,
            bodyType: "html",
            toEmail: e?.email,
          };
          console.log(payload2);
          await sendEmail(payload2);
        });
      } else {
        res.status(200).json({
          success: false,
        });
      }
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

const resheduleMsg = async (req, res) => {
  const { interviewId, message, newTimeStart, newEndTime } = req.body;
  try {
    const findClient = await JobsInterview.findOne({ _id: interviewId });

    const insertData = await ReSheduleInterview.create({
      interviewId,
      message,
      newTimeStart,
      newEndTime,
    });
    if (insertData) {
      const notifications = await Notifications.create({
        userId: findClient?.clientId,
        type: "Interview",
        notificationDetail: findClient?._id,
        title: "Candidate requested for re-schedule",
        details: `Candidate requested for re-schedule due to ${message}`,
      });
      const userData = await Users.findOne({ _id: findClient?.clientId });
      const payload = {
        subject: "Candidate requested for re-schedule",
        emailbody: `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Re-Schedule Interview Request</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
              }
              .container {
                  width: 80%;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f9f9f9;
                  border: 1px solid #ddd;
                  border-radius: 8px;
              }
              .header {
                  text-align: center;
                  padding-bottom: 20px;
              }
              .content {
                  margin-bottom: 20px;
              }
              .button {
                  display: inline-block;
                  padding: 10px 20px;
                  color: #fff;
                  background-color: #007bff;
                  text-decoration: none;
                  border-radius: 5px;
              }
              .footer {
                  text-align: center;
                  font-size: 0.9em;
                  color: #777;
              }
          </style>
      </head>
      <body>
          <div class="container">
            
              <div class="content">
                  <p>Dear Client ,</p>
                  <p>There is a interview re-schedule Request </p>
                  <p>Reason : ${message} </p>
                  <p>Please find the updated time by candidate :</p>
                
                  <p>User is available between : ${newTimeStart}</p>
                  <p>Best regards,</p>
              </div>
              <div class="footer">
                  <p>This email was sent to ${userData?.email}. If you have any questions, please contact us at support@hireinsecond.com.</p>
              </div>
          </div>
      </body>
      </html>
      `,
        bodyType: "html",
        toEmail: userData?.email,
      };

      await sendEmail(payload);
      res.status(200).json({
        success: true,
      });
    } else {
      res.status(200).json({
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
const getRescheduleMessage = async (req, res) => {
  const id = req.params.id;
  try {
    const data = await ReSheduleInterview.find({ interviewId: id }).select(
      "-__v"
    );
    console.log(data);
    if (data) {
      const interviewName = await JobsInterview.findById(id);
      let newData = { data, interviewName: interviewName?.title };
      res.status(200).json({
        success: true,
        data: newData,
      });
    } else {
      res.status(200).json({
        success: false,
        data: null,
      });
    }
  } catch (error) {
    console.log(error, "errorororoor");
    res.status(500).json({
      error,
    });
  }
};
const acceptInterview = async (req, res) => {
  const { interviewId, status, interviewRejectedReason } = req.body;
  try {
    const data = await JobsInterview.findById(interviewId);
    if (data) {
      data.isAccepted = status;
      data.interviewRejectedReason = interviewRejectedReason;
      if (status.toUpperCase() === "REJECTED") {
        data.status = "INACTIVE";
        data.reason = "Interview cancelled due to candidate rejected invite";
      }
      const jobTitle = await Jobs.findOne({ _id: data?.jobId });
      const users = await Users.findOne({ _id: data?.employeeId });
      const client = await Users.findOne({ _id: data?.clientId });
      const payload = {
        subject: `Interview ${status}`,
        emailbody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Zoom Interview ${status}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    width: 80%;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                .header {
                    text-align: center;
                    padding-bottom: 20px;
                }
                .content {
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    color: #fff;
                    background-color: #007bff;
                    text-decoration: none;
                    border-radius: 5px;
                }
                .footer {
                    text-align: center;
                    font-size: 0.9em;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>${data?.title}</h2>
                </div>
                <div class="content">
                    <p>Dear Client ,</p>
                    <p>Candidate has ${status} the interview for ${jobTitle?.jobTitle
          } position at ${client?.companyName}. 
                    <p>${status === "accepted"
            ? null
            : `We look forward to speaking with you`
          }.</p>
                    <p>Best regards,</p>
                    <p>${client?.firstName} <br>
                       ${jobTitle?.jobTitle}<br>
                      
                </div>
                <div class="footer">
                    <p>This email was sent to ${client?.email
          }. If you have any questions, please contact us at support@hireinsecond.com.</p>
                </div>
            </div>
        </body>
        </html>
        `,
        bodyType: "html",
        toEmail: client?.email,
      };

      await sendEmail(payload);
      const notifications = await Notifications.create({
        userId: client?._id,
        type: "Interview",
        notificationDetail: interviewId,
        title: `Interview ${status}`,
        details: `Interview has been ${status} by candidate`,
      });
      await data.save();
      res.status(200).json({
        success: true,
        message: "Successfully Reshedule",
      });
    } else {
      res.status(200).json({
        success: false,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error,
    });
  }
};

const acceptReSchedulingRequest = async (req, res) => {
  const { reqId, status, interviewRejectedReason, rejectedType } = req.body;
  try {
    const data = await ReSheduleInterview.findById(reqId);
    if (data) {
      const newData = await JobsInterview.findById(data?.interviewId);
      data.isAccepted = status;
      data.rejectedType = rejectedType;
      data.rejectedReason = interviewRejectedReason;
      const jobTitle = await Jobs.findOne({ _id: newData?.jobId });
      const users = await Users.findOne({ _id: newData?.employeeId });
      const client = await Users.findOne({ _id: newData?.clientId });
      if (users) {
        const payload = {
          subject: `Interview ReScheduling  ${status}`,
          emailbody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Zoom Interview ReScheduling  ${status}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    width: 80%;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                .header {
                    text-align: center;
                    padding-bottom: 20px;
                }
                .content {
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    color: #fff;
                    background-color: #007bff;
                    text-decoration: none;
                    border-radius: 5px;
                }
                .footer {
                    text-align: center;
                    font-size: 0.9em;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>${newData?.title}</h2>
                </div>
                <div class="content">
                    <p>Dear ${users?.firstName} ,</p>
                    <p>Client has ${status} the interview re-scheduling request for ${jobTitle?.jobTitle
            } position at ${client?.companyName}. 
                    <p>${status === "accepted"
              ? null
              : `Reason :::: ${interviewRejectedReason}`
            }.</p>
                    <p>Best regards,</p>
                    <p>${client?.firstName} <br>
                       ${jobTitle?.jobTitle}<br>
                      
                </div>
                <div class="footer">
                    <p>This email was sent to ${users?.email
            }. If you have any questions, please contact us at support@hireinsecond.com.</p>
                </div>
            </div>
        </body>
        </html>
        `,
          bodyType: "html",
          toEmail: users?.email,
        };
        await sendEmail(payload);
        const notifications = await Notifications.create({
          userId: users?._id,
          type: "Interview",
          notificationDetail: newData?._id,
          title: `Interview ${status}`,
          details: `Interview Re-scheduling  has been ${status} by client`,
        });
      }

      await data.save();
      res.status(200).json({
        success: true,
      });
    } else {
      res.status(200).json({
        success: false,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error,
    });
  }
};
const addInterviewFeedback = async (req, res) => {
  const { interviewId, feedback, recommendation, rating, notes } = req.body;

  if (!interviewId) {
    return res
      .status(400)
      .json({ success: false, message: "interviewId is required" });
  }
  if (!feedback && !recommendation && !notes) {
    return res
      .status(400)
      .json({ success: false, message: "feedback or evaluation notes are required" });
  }
  try {
    const feedbackPayload =
      typeof feedback === "object"
        ? JSON.stringify(feedback)
        : (feedback || notes || recommendation);

    const updateFields = {
      feedback: feedbackPayload,
    };
    if (recommendation) {
      updateFields.reason = recommendation;
    }

    const result = await JobsInterview.updateOne(
      { _id: interviewId },
      { $set: updateFields }
    );
    if (result.matchedCount >= 1 || result.modifiedCount >= 1) {
      res.status(200).json({
        success: true,
        message: "Successfully submitted feedback",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

const inviteBenchResource = async (req, res) => {
  const { interviewId, email, employeeId } = req.body;

  // Validation checks
  if (!interviewId) {
    return res
      .status(400)
      .json({ success: false, message: "interviewId is required" });
  }
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "email is required" });
  }

  try {
    const employee = await EmployeeOnboarding.findById(employeeId);
    const client = await Users.findById(employee?.companyId);
    const interview = await JobsInterview.findById(interviewId);
    const jobTitle = await Jobs.findById(interview?.jobId);

    if (employee) {
      // Upsert operation
      const filter = { interviewId, employeeId };
      const update = { email, interviewId, employeeId, name: employee?.name };
      const options = { upsert: true, new: true };

      const result = await InviteEmployee.findOneAndUpdate(
        filter,
        update,
        options
      );
      const payload = {
        subject: `Interview Scheduled`,
        emailbody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Zoom Interview Scheduled</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    width: 80%;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                .header {
                    text-align: center;
                    padding-bottom: 20px;
                }
                .content {
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    color: black;
                    background-color: #007bff;
                    border-radius: 5px;
                    opacity:1
                }
                .footer {
                    text-align: center;
                    font-size: 0.9em;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>${interview?.title}</h2>
                </div>
                <div class="content">
                    <p>Dear ${employee?.name} ,</p>
                    <p>Client has scheduled the interview for ${jobTitle?.jobTitle
          } position </p>
                    <p>Best regards,</p>
                    <p>${client?.firstName} <br>
                    <ul>
                    <li><strong> Date:</strong>${moment(
            interview?.meetingStartTime
          ).format("DD MMM YY, LT")}</li>
                    <li><strong> Duration:</strong> ${interview.duration
          } min</li>
                </ul>
                <p>To join the Zoom meeting, please click the link below:</p>
                <p><a href=${interview?.joinUrl
          } class="button">Join Zoom Meeting</a></p>
                <p>If the link does not work, you can use the following details to join manually:</p>
                <ul>
                    <li><strong>Meeting ID:</strong> ${interview?.meetingId
          }</li>
                    <li><strong>Passcode:</strong>${interview?.password}</li>
                </ul> 
                      
                </div>
                <div class="footer">
                    <p>This email was sent to ${email}. If you have any questions, please contact us at support@hireinsecond.com.</p>
                </div>
            </div>
        </body>
        </html>
        `,
        bodyType: "html",
        toEmail: email,
      };

      await sendEmail(payload);
      res.status(200).json({
        success: true,
        message: "Successfully submitted feedback",
        data: result,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};
const checkInterviewStatus = async (req, res) => {
  const id = req.params.id;
  try {
    const checkExists = await JobsInterview.find({
      applicationId: id,
      status: "ACTIVE",
      feedback: null,
    });
    if (checkExists.length > 0) {
      const interview = checkExists[0];
      const endTime = moment(interview.meetingStartTime)
        // .add(interview.duration, "minutes")
        .add(10, "minutes");
      const currentTime = moment();

      if (currentTime.isAfter(endTime)) {
        await JobsInterview.updateOne(
          { _id: interview._id },
          {
            $set: {
              status: "INACTIVE",
              reason: "Auto-cancelled due to time expiration",
            },
          }
        );
        return res.status(200).json({
          success: true,
          message:
            "Your last scheduled interview's time has been passed so we have cancelled that interview and now you can schedule a new interview",
        });
      } else {
        return res.status(302).json({
          success: false,
          message:
            "You already have scheduled interview , you cannot post new interview if you have feedback pending or interview waiting",
        });
      }
    } else {
      return res.status(200).json({
        success: true,
        message: "Can start scheduling interview",
      });
    }
  } catch (error) {
    res.status(500).json({ error });
  }
};
const getJobApplication = async (id) => {
  const data = await JobsApplications.findById(id);
  return data;
};
const getEmployeeThroughJobApplication = async (
  jobId,
  companyId,
  applicationId
) => {
  try {
    const data = await JobsApplications.find({ jobId, companyId });
    console.log(data, "applicationLists");

    const arr = await Promise.all(
      data.map(async (element) => {
        const employee = await EmployeeOnboarding.findById(element?.employeeId);
        console.log(employee, "employeeee");
        const interview = await JobsInterview.findOne({
          applicationId: applicationId,
          clientId: element?.clientId,
        });
        if (
          interview &&
          element?.companyId === interview?.employeeId &&
          interview?.applicationId === applicationId
        ) {
          return {
            applicationDetails: await getJobApplication(element?._id),
            employee, // Include the employee object in the array
          };
        }
      })
    );
    console.log(arr, "arr");
    return arr; // Return the resolved array
  } catch (error) {
    console.error("Error fetching employees:", error);
    throw error; // Optionally, propagate the error
  }
};

const getEmployeeThroughJobApplicationClient = async (
  jobId,
  clientId,
  applicationId
) => {
  try {
    const data = await JobsApplications.find({ jobId, clientId });
    console.log(data, "applicationLists");

    const arr = await Promise.all(
      data.map(async (element) => {
        if (!element) {
        }
        let employee = await EmployeeOnboarding.findById(element?.employeeId);
        console.log(applicationId);
        console.log(element?.employeeId);
        const interview = await JobsInterview.findOne({
          applicationId: applicationId,
          clientId: element?.clientId,
        });

        console.log(interview, "interView");
        if (
          interview &&
          element?.companyId === interview?.employeeId &&
          interview?.applicationId === applicationId
        ) {
          if (!employee) {
            employee = await Users.findById(element?.companyId).select(
              "-password"
            );
          }
          console.log(employee, "employeeee");
          return {
            applicationDetails: await getJobApplication(element?._id),
            employee, // Include the employee object in the array
          };
        }
      })
    );
    console.log(arr, "arr");
    return arr; // Return the resolved array
  } catch (error) {
    console.error("Error fetching employees:", error);
    throw error; // Optionally, propagate the error
  }
};

const getEmployeeInterviewLists = async (req, res) => {
  const jobId = req.query.jobId;
  const companyId = req.query.companyId;

  if (!companyId || !jobId) {
    return res.status(400).json({ message: "Bad Request" });
  }

  try {
    const data = await JobsInterview.find({ jobId, employeeId: companyId });
    console.log(data, "datatataat");

    // Map over JobsInterview data to get employees through job application
    const arr = await Promise.all(
      data.map(async (element) => {
        const employees = await getEmployeeThroughJobApplication(
          element?.jobId,
          element?.employeeId,
          element?.applicationId
        );
        return employees;
      })
    );

    res.status(200).json({
      message: "Successfully Fetched Record",
      data: {
        jobsDetails: await getJobslist(jobId),
        employeeDetails: arr[0],
      }, // Array of objects containing interview and employee data
    });
  } catch (error) {
    console.error("Error fetching interview lists:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEmployeeInterviewListsForClient = async (req, res) => {
  const jobId = req.query.jobId;
  const clientId = req.query.clientId;

  if (!clientId || !jobId) {
    return res.status(400).json({ message: "Bad Request" });
  }

  try {
    const data = await JobsInterview.find({ jobId, clientId: clientId });
    console.log(data, "datatataat");

    // Map over JobsInterview data to get employees through job application
    const arr = await Promise.all(
      data.map(async (element) => {
        const employees = await getEmployeeThroughJobApplicationClient(
          element?.jobId,
          element?.clientId,
          element?.applicationId
        );
        return employees?.filter((i) => i && Object.keys(i).length > 0);
      })
    );

    res.status(200).json({
      message: "Successfully Fetched Record",
      data: {
        jobsDetails: await getJobslist(jobId),
        employeeDetails: arr[0].filter((i) => i !== null),
      }, // Array of objects containing interview and employee data
    });
  } catch (error) {
    console.error("Error fetching interview lists:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
module.exports = {
  addInterview,
  getInterviewList,
  getInterviewById,
  resheduleInterview,
  deleteInterview,
  resheduleMsg,
  getRescheduleMessage,
  acceptInterview,
  acceptReSchedulingRequest,
  addInterviewFeedback,
  inviteBenchResource,
  checkInterviewStatus,
  getEmployeeInterviewLists,
  getEmployeeInterviewListsForClient,
};
