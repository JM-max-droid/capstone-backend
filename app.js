require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const nodemailer = require("nodemailer");

// ===============================
// ✅ Import Routes
// ===============================
const lookupRoute = require("./routes/registration/lookupRoute");
const registerRoute = require("./routes/registration/registerRoute");
const verificationRoute = require("./routes/registration/verificationRoute");
const resendVerificationRoute = require("./routes/registration/resendVerificationRoute");
const loginRoute = require("./routes/loginRoute");
const realtimePhotoRoute = require("./routes/registration/realtimephotoRoute");
const qrcodeRoute = require("./routes/registration/qrcodeRoute");

const userRoute = require("./routes/student/userRoute");
const studentRoute = require("./routes/oss/studentRoute");
const studentAttendanceRoute = require("./routes/student/attendanceRoute");
const scannerLookupRoute = require("./routes/ssc/scannerLookupRoute");
const sscAttendanceRoute = require("./routes/ssc/attendanceRoute");
const sscUserRoute = require("./routes/ssc/userRoute");
const studentUserRoute = require("./routes/student/userRoute");
const sscStudentsRoute = require("./routes/ssc/sscStudentsRoute");

const ossAttendanceRoute = require("./routes/oss/attendanceRoute");
const eventRoute = require("./routes/oss/eventRoute");
const ossRoute = require("./routes/oss/ossRoute");
const notificationRoute = require("./routes/oss/notificationRoutes");
const ossUserRoute = require("./routes/oss/userRoute");

// SSC NOTIFICATION ROUTE (view-only)
const sscNotificationRoute = require("./routes/ssc/notificationRoute");

// YEAR-END ROUTE
const yearEndRoute = require("./routes/oss/yearEndRoute");

// SUPERADMIN ROUTES
const superadminUserRoute        = require("./routes/superadmin/userRoute");
const superadminUserProfileRoute = require("./routes/superadmin/userProfileRoute");

// ===============================
// ✅ Import Models (para sa debug)
// ===============================
const Notification = require("./models/Notification");

// ===============================
// ✅ App Setup
// ===============================
const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// ===============================
// ✅ Connect MongoDB
// ===============================
connectDB();

// ===============================
// ✅ Nodemailer transporter
// ===============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ===============================
// ✅ Routes
// ===============================

app.use("/api/register/qrcode", qrcodeRoute);
app.use("/api/register/photo", realtimePhotoRoute);
app.use("/api/register/verify", verificationRoute);
app.use("/api/register/resend-verification", resendVerificationRoute);
app.use("/api/register", registerRoute);

app.use("/api/oss/notifications", notificationRoute);
app.use("/api/ssc/notifications", sscNotificationRoute);

app.use("/api/student/attendance", studentAttendanceRoute);
app.use("/api/ssc/attendance", sscAttendanceRoute);
app.use("/api/attendance", ossAttendanceRoute);

app.use("/api/scanner", scannerLookupRoute);
app.use("/api/student/user", studentUserRoute);
app.use("/api/student", studentRoute);
app.use("/api/ssc/user", sscUserRoute);
app.use("/api/ssc/students", sscStudentsRoute);
app.use("/api/users", ossUserRoute);

app.use("/api/year-end", yearEndRoute);

app.use("/api/superadmin/users", superadminUserProfileRoute);
app.use("/api/superadmin", superadminUserRoute);

app.use("/api/lookup", lookupRoute);
app.use("/api/login", loginRoute);
app.use("/api/user", userRoute);
app.use("/api/events", eventRoute);
app.use("/api/oss", ossRoute);

// ===============================
// ✅ Health check
// ===============================
app.get("/", (req, res) => {
  res.json({ message: "🚀 AttendSure Backend API is running!" });
});

// ===============================
// ✅ Test email
// ===============================
app.post("/api/test-email", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Missing recipient email" });
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject: "Test Email from AttendSure",
      text: "This is a test email. Your NodeMailer setup works!",
    });
    res.json({ message: "✅ Test email sent successfully" });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({ error: "Error sending email" });
  }
});

// ===============================
// ✅ DEBUG: Check notifications
// ===============================
app.get("/api/debug/notifications", async (req, res) => {
  try {
    const all = await Notification.find({}).lean();
    res.json({ total: all.length, notifications: all });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===============================
// ✅ 404 handler
// ===============================
app.use((req, res) => {
  console.log("❌ 404 - Route not found:", req.method, req.path);
  res.status(404).json({ 
    error: "Route not found",
    path: req.path,
    method: req.method
  });
});

// ===============================
// ✅ Global error handler
// ===============================
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;
