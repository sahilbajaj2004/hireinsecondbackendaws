const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const JobsApplications = require("../models/jobsApplicationModel");
const Jobs = require("../models/jobsModel");
const SavedJobs = require("../models/savedJobs");
const Users = require("../models/userModel");
const { getSavedJobs, upsertSavedJob } = require("./jobsController");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("saved-job writes reject a different requested user", async () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const res = response();

  await upsertSavedJob(
    {
      user: { _id: ownerId },
      body: {
        userId: new mongoose.Types.ObjectId().toString(),
        jobId: new mongoose.Types.ObjectId().toString(),
        isSaved: true,
      },
    },
    res
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test("saved-job reads include closed roles and preserve saved time", async () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const companyId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();
  const savedAt = new Date("2026-10-28T10:00:00.000Z");
  const originals = {
    savedFind: SavedJobs.find,
    countDocuments: Jobs.countDocuments,
    aggregate: Jobs.aggregate,
    userFindOne: Users.findOne,
    applicationFindOne: JobsApplications.findOne,
  };

  SavedJobs.find = () => ({
    select: () => ({
      sort: () => ({
        lean: async () => [{ jobId, createdAt: savedAt }],
      }),
    }),
  });
  Jobs.countDocuments = async (query) => {
    assert.equal(query.status, undefined);
    assert.equal(query.$expr, undefined);
    return 1;
  };
  Jobs.aggregate = async () => [
    {
      _id: new mongoose.Types.ObjectId(jobId),
      companyId,
      jobTitle: "Closed saved role",
      status: "INACTIVE",
      positions: "0",
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
    },
  ];
  Users.findOne = async () => ({ companyName: "Example Company", status: true });
  JobsApplications.findOne = async () => null;

  try {
    const res = response();
    await getSavedJobs(
      {
        user: { _id: ownerId, userType: "personal" },
        query: { userId: ownerId, pageId: 1, pageSize: 100 },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.totalCount, 1);
    assert.equal(res.body.data[0].status, "INACTIVE");
    assert.deepEqual(res.body.data[0].savedAt, savedAt);
  } finally {
    SavedJobs.find = originals.savedFind;
    Jobs.countDocuments = originals.countDocuments;
    Jobs.aggregate = originals.aggregate;
    Users.findOne = originals.userFindOne;
    JobsApplications.findOne = originals.applicationFindOne;
  }
});
