require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const nodemailer = require("nodemailer");

// ==========================================
// ✅ IMPORT ROUTES
// ==========================================

// Registration routes
const lookupRoute = require("./routes/registration/lookupRoute");
const registerRoute = require("./routes/registration/registerRoute");
const verificationRoute = require("./routes/registration/verificationRoute");
const realtimePhotoRoute = require("./routes/registration/realtimephotoRoute");
const qrcodeRoute = require("./routes/registration/qrcodeRoute");

// Authentication
const loginRoute = require("./routes/loginRoute");

// Student routes
const userRoute = require("./routes/student/userRoute");
const studentRoute = require("./routes/student/studentRoute");

// SSC routes
const scannerLookupRoute = require("./routes/ssc/scannerLookupRoute");
const sscAttendanceRoute = require("./routes/ssc/attendanceRoute");

// OSS routes
const ossAttendanceRoute = require("./routes/oss/attendanceRoute");
const eventRoute = require("./routes/oss/eventRoute");
const ossRoute = require("./routes/oss/ossRoute");
const notificationRoute = require("./routes/oss/notificationRoutes");
const ossUserRoute = require("./routes/oss/userRoute");

// ==========================================
// ✅ EXPRESS APP SETUP
// ==========================================

const app = express();

// ==========================================
// ✅ MIDDLEWARE
// ==========================================

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// ==========================================
// ✅ DATABASE CONNECTION
// ==========================================

connectDB();

// ==========================================
// ✅ NODEMAILER TRANSPORTER
// ==========================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ==========================================
// ✅ API ROUTES - CRITICAL ORDER!
// ==========================================

// ------------------------------------------
// 1️⃣ REGISTRATION ROUTES (Most Specific First)
// ------------------------------------------
app.use("/api/register/qrcode", qrcodeRoute);
app.use("/api/register/photo", realtimePhotoRoute);
app.use("/api/register/verify", verificationRoute);
app.use("/api/register", registerRoute);

// ------------------------------------------
// 2️⃣ AUTHENTICATION
// ------------------------------------------
app.use("/api/login", loginRoute);

// ------------------------------------------
// 3️⃣ OSS SPECIFIC ROUTES (Before general /api/oss)
// ------------------------------------------
app.use("/api/oss/notifications", notificationRoute);

// ------------------------------------------
// 4️⃣ ATTENDANCE ROUTES
// ------------------------------------------
app.use("/api/ssc/attendance", sscAttendanceRoute);
app.use("/api/attendance", ossAttendanceRoute);

// ------------------------------------------
// 5️⃣ SCANNER ROUTES - ✅ FIXED!
// ------------------------------------------
// Mobile QR Scanner: POST /api/scannerLookup
app.use("/api/scannerLookup", scannerLookupRoute);

// Student Info Page: GET /api/scanner/:idNumber
app.use("/api/scanner", scannerLookupRoute);

// ------------------------------------------
// 6️⃣ USER & STUDENT ROUTES
// ------------------------------------------
app.use("/api/users", ossUserRoute);       // OSS user lookup
app.use("/api/user", userRoute);           // Student user profile
app.use("/api/student", studentRoute);     // Student CRUD operations

// ------------------------------------------
// 7️⃣ EVENT ROUTES
// ------------------------------------------
app.use("/api/events", eventRoute);

// ------------------------------------------
// 8️⃣ OTHER ROUTES
// ------------------------------------------
app.use("/api/lookup", lookupRoute);

// ------------------------------------------
// 9️⃣ GENERAL OSS ROUTES (LAST among /api/oss routes)
// ------------------------------------------
app.use("/api/oss", ossRoute);

// ==========================================
// ✅ ROOT ENDPOINT - API DOCUMENTATION
// ==========================================

app.get("/", (req, res) => {
  res.json({ 
    status: "🚀 AttendSure Backend API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: {
        register: "POST /api/register",
        verify: "POST /api/register/verify",
        login: "POST /api/login",
        uploadPhoto: "POST /api/register/photo",
        generateQR: "POST /api/register/qrcode",
      },
      scanner: {
        scanQR: "POST /api/scannerLookup (mobile app)",
        getStudent: "GET /api/scanner/:idNumber (student info)",
      },
      attendance: {
        markAttendance: "POST /api/attendance",
        getAttendance: "GET /api/attendance",
        autoMarkAbsent: "POST /api/attendance/auto-mark-absent",
        updateAttendance: "PATCH /api/attendance/:id",
        deleteAttendance: "DELETE /api/attendance/:id",
        exportExcel: "GET /api/attendance/export",
        sscAttendance: "POST /api/ssc/attendance",
      },
      events: {
        getAllEvents: "GET /api/events",
        getEvent: "GET /api/events/:id",
        createEvent: "POST /api/events",
        updateEvent: "PATCH /api/events/:id",
        deleteEvent: "DELETE /api/events/:id",
      },
      users: {
        getProfile: "GET /api/user",
        updateProfile: "PATCH /api/user/:id",
        getOSSUsers: "GET /api/users",
      },
      notifications: {
        getNotifications: "GET /api/oss/notifications",
        createNotification: "POST /api/oss/notifications",
      },
    }
  });
});

// ==========================================
// ✅ TEST EMAIL ENDPOINT
// ==========================================

app.post("/api/test-email", async (req, res) => {
  const { to } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: "Missing recipient email" });
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject: "Test Email from AttendSure",
      text: "This is a test email. Your NodeMailer setup works!",
    });
    
    console.log("✅ Test email sent to:", to);
    res.json({ message: "✅ Test email sent successfully" });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({ error: "Error sending email", details: error.message });
  }
});

// ==========================================
// ✅ 404 HANDLER (MUST BE SECOND TO LAST!)
// ==========================================

app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  
  res.status(404).json({ 
    error: "Route not found",
    path: req.path,
    method: req.method,
    message: `The endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: [
      "POST /api/scannerLookup - Scan QR code",
      "GET /api/scanner/:idNumber - Get student info",
      "POST /api/attendance - Mark attendance",
      "GET /api/attendance - Get attendance records",
      "GET /api/events - Get events",
      "POST /api/register - Register new student",
      "POST /api/login - User login",
    ]
  });
});

// ==========================================
// ✅ GLOBAL ERROR HANDLER (ABSOLUTELY LAST!)
// ==========================================

app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:");
  console.error("Path:", req.path);
  console.error("Method:", req.method);
  console.error("Error:", err.stack);
  
  res.status(err.status || 500).json({ 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    path: req.path,
  });
});

// ==========================================
// ✅ EXPORT APP
// ==========================================

module.exports = app;