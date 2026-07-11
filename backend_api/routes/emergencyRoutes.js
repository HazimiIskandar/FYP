const express = require("express");
const router = express.Router();
const db = require("../config/db");

// TRIGGER EMERGENCY
router.post("/trigger", (req, res) => {
  const { senior_id } = req.body;

  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  // Schema note: Emergency_Event does NOT have an `event_type` column
  // (see SQL Update 4-7.sql). `event_type='SOS'` is folded into
  // `escalation_level` for the row, matching the convention used in
  // services/emergencyService.js.
  const sql = `
    INSERT INTO Emergency_Event (senior_id, event_status, escalation_level)
    VALUES (?, 'Open', 'Level 1 — SOS')
  `;

  db.query(sql, [senior_id], (err, result) => {
    if (err) return res.status(500).json(err);

    res.json({
      message: "Emergency triggered",
      event_id: result.insertId
    });
  });
});

// GET EMERGENCY HISTORY
router.get("/:senior_id", (req, res) => {
  const sql = `
    SELECT *
    FROM Emergency_Event
    WHERE senior_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [req.params.senior_id], (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result);
  });
});

module.exports = router;