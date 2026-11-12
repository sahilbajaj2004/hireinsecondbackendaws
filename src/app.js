const express = require("express");
const app = express();
require("dotenv").config();
require("./db/mongo");
require("./models/userModel");
require("./cronJobs/allotedCron");
require("./config/passport");
var cors = require("cors");
const userRoutes = require("./routers/userRouter");
const uploadRoute = require("./routers/uploadRouter");
const employeeRoute = require("./routers/employeeRouter");
const jobsRoute = require("./routers/jobsRouter");
const dashboardRoute = require("./routers/dashboardRouter");
const jobApplicationRoute = require("./routers/jobsApplicationsRouter");
const locationRouter = require("./routers/locationRouter");
const paymentRouter = require("./routers/paymentRouter");
const notificationRouter = require("./routers/notificationRouter");
const meetingRouter = require("./routers/meetingRouter");
const contactRouter = require("./routers/contactRouter");
const walletRouter = require("./routers/walletRouter");
const OnboardingRouter = require("./routers/OnboardingRouter");
const adminRoutes = require("./routers/adminRoutes");
const languageRoutes = require("./routers/languageRoutes");
const passport = require('passport');
const authRoutes = require('./routers/authRoutes')


const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());
app.use(passport.initialize())
app.get("/api", (req, res) => {
  res.send("Welcome to HireInSecond.");
});

app.use("/api/auth", authRoutes )
app.use("/api/user", userRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/", employeeRoute);
app.use("/api/", jobsRoute);
app.use("/api/", dashboardRoute);
app.use("/api/", jobApplicationRoute);
app.use("/api/", locationRouter);
app.use("/api/", paymentRouter);
app.use("/api/", notificationRouter);
app.use("/api/", meetingRouter);
app.use("/api/", contactRouter);
app.use("/api/", walletRouter);
app.use("/api/", OnboardingRouter);
app.use("/api/", adminRoutes);
app.use("/api/", languageRoutes);

app.listen(port, () => {
  console.log(`connected started at ${port}`);
});

// Global crash guards. Express 4 does not catch rejections from async route
// handlers automatically: one rejected await outside a controller's try/catch
// killed the whole Node process (e.g. POST /addQueries). These logs keep the
// server serving while the offending route still answers its request.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
