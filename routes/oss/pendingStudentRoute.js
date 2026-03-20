const express    = require("express");
const router     = express.Router();
const controller = require("../../controllers/pendingStudentController");

// ─────────────────────────────────────────────────────────────────────────────
// Static routes MUST come BEFORE /:id — otherwise Express treats
// "clear-all" and "clear" as an :id value and calls the wrong handler.
// ─────────────────────────────────────────────────────────────────────────────

// DELETE /oss/pending/clear-all       — wipe all approved + rejected
router.delete("/clear-all",      controller.clearAll);

// DELETE /oss/pending/clear/:status   — wipe by status (approved|rejected)
router.delete("/clear/:status",  controller.clearByStatus);

// GET    /oss/pending
router.get("/",                  controller.getPendingStudents);

// POST   /oss/pending/:id/approve
router.post("/:id/approve",      controller.approveStudent);

// POST   /oss/pending/:id/reject
router.post("/:id/reject",       controller.rejectStudent);

// DELETE /oss/pending/:id
router.delete("/:id",            controller.deletePendingStudent);

module.exports = router;