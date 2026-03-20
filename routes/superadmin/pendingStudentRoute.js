// routes/superadmin/pendingStudentRoute.js
const express    = require("express");
const router     = express.Router();
const controller = require("../../controllers/pendingStudentController");

// GET  /superadmin/pending               — list all submissions (all statuses)
router.get("/",                    controller.getPendingStudents);

// POST /superadmin/pending/:id/approve   — approve a pending student
router.post("/:id/approve",        controller.approveStudent);

// POST /superadmin/pending/:id/reject    — reject with reason
router.post("/:id/reject",         controller.rejectStudent);

// DELETE /superadmin/pending/clear-all   — delete ALL approved + rejected records
// ⚠️ Must be BEFORE /:id and /clear/:status so "clear-all" isn't treated as :id
router.delete("/clear-all",        controller.clearAll);

// DELETE /superadmin/pending/clear/:status — delete all records of a given status
// ⚠️ Must be BEFORE /:id so "clear" isn't treated as :id
router.delete("/clear/:status",    controller.clearByStatus);

// DELETE /superadmin/pending/:id         — permanently delete a single record
router.delete("/:id",              controller.deletePendingStudent);

module.exports = router;