const test = require("node:test");
const assert = require("node:assert/strict");

test("Duration parsing extracts clean integer minutes", () => {
  const parseDuration = (raw) => parseInt(String(raw || 45).replace(/[^\d]/g, ""), 10) || 45;

  assert.equal(parseDuration("45m"), 45);
  assert.equal(parseDuration("30m"), 30);
  assert.equal(parseDuration("60m"), 60);
  assert.equal(parseDuration(45), 45);
  assert.equal(parseDuration(""), 45);
  assert.equal(parseDuration(undefined), 45);
});

test("Client application mapping preserves candidate screeningAnswers and employee info", () => {
  const item = {
    _id: "app123",
    status: "IN_PROCESS",
    resume: "https://example.com/aditya.pdf",
    sentAt: new Date(),
    lastUpdatedAt: new Date(),
    jobId: "job999",
    clientId: "client888",
    companyId: "company777",
    employeeId: "emp666",
    screeningAnswers: {
      fullName: "Aditya Kumar",
      email: "aditya@agency.in",
      location: "Delhi NCR",
    },
    applicantDetails: null,
    employeeDetails: {
      name: "Aditya Kumar",
      skills: ["React", "Python"],
    },
    latestInterview: null,
  };

  const directCandidateName = item.screeningAnswers?.fullName || "";
  const nameParts = directCandidateName.trim().split(/\s+/);
  const directFirst = nameParts[0] || "";
  const directLast = nameParts.slice(1).join(" ");

  const mapped = {
    applicationId: item._id,
    status: item.status,
    resume: item.resume,
    screeningAnswers: item.screeningAnswers || null,
    employeeId: item.employeeId || null,
    vendorDetails: {
      firstName: item.applicantDetails?.firstName || directFirst || "",
      lastName: item.applicantDetails?.lastName || directLast || "",
      profilePic: item.applicantDetails?.profilePic || "",
      employeeId: item.employeeId || null,
      employeeName: item.employeeDetails?.name || directCandidateName || "",
    },
  };

  assert.equal(mapped.applicationId, "app123");
  assert.equal(mapped.screeningAnswers.fullName, "Aditya Kumar");
  assert.equal(mapped.vendorDetails.employeeName, "Aditya Kumar");
  assert.equal(mapped.vendorDetails.firstName, "Aditya");
  assert.equal(mapped.vendorDetails.lastName, "Kumar");
  assert.equal(mapped.employeeId, "emp666");
});
