const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

var Schema = mongoose.Schema;
const UserSchema = Schema({
  firstName: {
    type: String,
    // required: true,
  },
  lastName: {
    type: String,
    // required: true,  
  },
  googleId: {
    type: String,
  },
  appleId: {
    type: String,
  },
  country: {
    type: String,
    // required: true,
  },
  email: {
    type: String,
    required: false,
    default: null,
  },
  phone: {
    type: String,
  },
  otpVerified: {
    type: Boolean,
    required: true,
    default: false,
  },
  pushToken: {
    type: String,
    default: null,
  },
  pushNotif: {
    type: Boolean,
    default: true,
  },
  skills: {
    type: mongoose.Schema.Types.Mixed,
    default: "",
  },
  otp: {
    type: String,
  },
  status: {
    type: Boolean,
    default: true,
  },
  userType: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    // required: true,
  },
  kycStatus: {
    type: String,
    required: true,
    default: "pending",
  },
  role: {
    type: String,
    required: false,
  },
  countryCode: {
    type: String,
    required: false,
  },
  companyName: {
    type: String,
    required: false,
  },
  companyRepresentative: {
    type: String,
    required: false,
  },
  strengthOfCompany: {
    type: String,
    required: false,
  },
  designation: {
    type: String,
    required: false,
  },
  exprience: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  document: {
    type: String,
  },
  profilePic: {
    type: String,
  },
  alloted: {
    type: Boolean,
    default: false,
  },
  salary: {
    type: Number,
  },
  resumeData: {
    type: String,
  },
  parsedResume: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  subscriptionStatus: {
    default: false,
    type: Boolean,
    required: false,
  },
  isProfileCompleted: {
    default: false,
    type: Boolean,
    required: true,
  },
  fullName: {
    type: String,
    required: false,
  },
  title: {
    type: String,
    required: false,
  },
  headline: {
    type: String,
    required: false,
  },
  location: {
    type: String,
    required: false,
  },
  bio: {
    type: String,
    required: false,
  },
  experience: {
    type: String,
    required: false,
  },
  experienceDetails: {
    type: Array,
    default: [],
  },
  experienceHistory: {
    type: Array,
    default: [],
  },
  workExperience: {
    type: Array,
    default: [],
  },
  educationDetails: {
    type: Array,
    default: [],
  },
  educationHistory: {
    type: Array,
    default: [],
  },
  projects: {
    type: Array,
    default: [],
  },
  certifications: {
    type: Array,
    default: [],
  },
  desiredRole: {
    type: String,
    required: false,
  },
  preferredRole: {
    type: String,
    required: false,
  },
  workMode: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  preferredWorkMode: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  workModes: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  preferredLocations: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  preferredLocation: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  expectedSalary: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  employmentType: {
    type: String,
    required: false,
  },
  noticePeriod: {
    type: String,
    required: false,
  },
  availability: {
    type: String,
    required: false,
  },
  portfolioUrl: {
    type: String,
    required: false,
  },
  linkedinUrl: {
    type: String,
    required: false,
  },
  linkedin: {
    type: String,
    required: false,
  },
  githubUrl: {
    type: String,
    required: false,
  },
  github: {
    type: String,
    required: false,
  },
  recruiterViews: {
    type: Number,
    default: 0,
  },
  openToOffers: {
    type: Boolean,
    default: true,
  },
  connectedAccounts: {
    google: {
      connected: { type: Boolean, default: false },
      email: { type: String, default: "" },
      id: { type: String, default: "" },
      connectedAt: { type: Date },
    },
    linkedin: {
      connected: { type: Boolean, default: false },
      url: { type: String, default: "" },
      username: { type: String, default: "" },
      connectedAt: { type: Date },
    },
    github: {
      connected: { type: Boolean, default: false },
      url: { type: String, default: "" },
      username: { type: String, default: "" },
      connectedAt: { type: Date },
    },
    portfolio: {
      connected: { type: Boolean, default: false },
      url: { type: String, default: "" },
      connectedAt: { type: Date },
    },
  },
}, { strict: false });

UserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

const Users = new mongoose.model("Users", UserSchema);
module.exports = Users;



