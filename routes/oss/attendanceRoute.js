const express = require("express");
const router = express.Router();
// 👉 IMPORT CONTROLLERS
const {
  createAttendance,
  getAttendance,
  autoMarkAbsent,
  updateAttendance,
  deleteAttendance,
  exportAttendance,
} = require("../../controllers/attendanceControllers");

console.log("📦 OSS Attendance Controllers loaded:", {
  createAttendance: typeof createAttendance,
  getAttendance: typeof getAttendance,
  autoMarkAbsent: typeof autoMarkAbsent,
  updateAttendance: typeof updateAttendance,
  deleteAttendance: typeof deleteAttendance,
  exportAttendance: typeof exportAttendance,
});

// ==============================
// ⚠️ CRITICAL: ROUTE ORDER MATTERS!
// Static routes MUST come BEFORE dynamic /:id routes
// ==============================

// ✅ 1. TEST ROUTE (for debugging)
router.get("/test", (req, res) => {
  console.log("✅ OSS Attendance test route hit!");
  res.json({ 
    message: "✅ OSS Attendance routes working!",
    endpoint: "/api/attendance",
    timestamp: new Date().toISOString()
  });
});

// ✅ 2. EXPORT ROUTE (MUST be before /:id!)
router.get("/export", (req, res, next) => {
  console.log("🎯 HIT /api/attendance/export!");
  console.log("📋 Query params:", req.query);
  next();
}, exportAttendance);

// ✅ 3. AUTO MARK ABSENT (specific route before /:id)
router.post("/auto-mark-absent", (req, res, next) => {
  console.log("🔴 POST /api/attendance/auto-mark-absent");
  next();
}, autoMarkAbsent);

// ✅ 4. GET ALL ATTENDANCE (general route)
router.get("/", (req, res, next) => {
  console.log("📥 GET /api/attendance - Query:", req.query);
  next();
}, getAttendance);

// ✅ 5. CREATE ATTENDANCE (general route)
router.post("/", createAttendance);

// ✅ 6. UPDATE ATTENDANCE (dynamic route - AFTER static routes!)
router.patch("/:id", (req, res, next) => {
  console.log("✏️ PATCH /api/attendance/:id -", req.params.id);
  next();
}, updateAttendance);

// ✅ 7. DELETE ATTENDANCE (dynamic route - AFTER static routes!)
router.delete("/:id", (req, res, next) => {
  console.log("🗑️ DELETE /api/attendance/:id -", req.params.id);
  next();
}, deleteAttendance);

console.log("✅ OSS Attendance routes configured!");

module.exports = router;