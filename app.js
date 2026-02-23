require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const https = require("https");

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
const studentEventRoute = require("./routes/student/eventRoute"); // ✅ NEW
const sscEventRoute     = require("./routes/ssc/eventRoute");     // ✅ NEW
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

const yearEndRoute = require("./routes/oss/yearEndRoute");

const superadminUserRoute         = require("./routes/superadmin/userRoute");
const superadminUserProfileRoute  = require("./routes/superadmin/userProfileRoute");
const superadminEventRoute        = require("./routes/superadmin/eventRoute"); // ✅ NEW
const superadminStudentRoute      = require("./routes/superadmin/studentRoute"); // ✅ NEW

// ===============================
// ✅ App Setup
// ===============================
const app = express();

app.set("trust proxy", 1);

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
// ✅ Routes
// ===============================

app.use("/api/register/qrcode", qrcodeRoute);
app.use("/api/register/photo", realtimePhotoRoute);
app.use("/api/register/verify", verificationRoute);
app.use("/api/register/resend-verification", resendVerificationRoute);
app.use("/api/register", registerRoute);

app.use("/api/oss/notifications", notificationRoute);

app.use("/api/student/attendance", studentAttendanceRoute);
app.use("/api/student/events", studentEventRoute); // ✅ NEW — must be before /api/student
app.use("/api/ssc/events", sscEventRoute);         // ✅ NEW — must be before /api/ssc
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
app.use("/api/superadmin/events", superadminEventRoute); // ✅ NEW — must be before /api/superadmin
app.use("/api/superadmin/students", superadminStudentRoute); // ✅ NEW — must be before /api/superadmin
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
  res.json({
    message: "AttendSure Backend API is running!",
    endpoints: {
      register: "POST /api/register",
      verify: "GET /api/register/verify?token=xxx",
      resendVerification: "POST /api/register/resend-verification",
      login: "POST /api/login",
      scanner: "GET /api/scanner/:idNumber",
      studentAttendance: "GET /api/student/attendance?userId=xxx",
      studentEvents: "GET /api/student/events", // ✅ NEW
      sscEvents: "GET /api/ssc/events",          // ✅ NEW
      superadminEvents: "GET /api/superadmin/events", // ✅ NEW
      sscAttendance: "POST /api/ssc/attendance",
      sscUser: "GET /api/ssc/user?idNumber=xxx",
      sscStudents: "GET /api/ssc/students",
      studentUser: "GET /api/student/user?idNumber=xxx",
      ossAttendance: "POST /api/attendance",
      events: "GET /api/events",
      superadminUsers: "GET /api/superadmin/users",
      superadminStudents: "GET /api/superadmin/students", // ✅ NEW
      yearEndReview: "GET /api/year-end/review",
      yearEndRun: "POST /api/year-end/run",
    },
  });
});

// ===============================
// ✅ Test email endpoint (using Resend HTTP API)
// ===============================
app.post("/api/test-email", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Missing recipient email" });

  try {
    const body = JSON.stringify({
      from: "AttendSure <onboarding@resend.dev>",
      to: [to],
      subject: "Test Email from AttendSure",
      html: "<p>This is a test email. Your email setup works!</p>",
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          "Authorization": "Bearer " + process.env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const req2 = https.request(options, (r) => {
        let data = "";
        r.on("data", (chunk) => { data += chunk; });
        r.on("end", () => {
          if (r.statusCode >= 200 && r.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error("Resend error: " + data));
          }
        });
      });
      req2.on("error", reject);
      req2.write(body);
      req2.end();
    });

    res.json({ message: "Test email sent successfully", id: result.id });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Error sending email", details: error.message });
  }
});

// ===============================
// ✅ 404 handler
// ===============================
app.use((req, res) => {
  console.log("404 - Route not found:", req.method, req.path);
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// ===============================
// ✅ Global error handler
// ===============================
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;