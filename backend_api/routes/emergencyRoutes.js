const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ================= TRIGGER EMERGENCY =================
router.post("/trigger", (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { senior_id } = req.body;
  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  const sql = `
    INSERT INTO Emergency_Event (senior_id, event_type, event_status, escalation_level)
    VALUES (?, 'SOS', 'Open', 'Level 1')
  `;

  db.query(sql, [senior_id], (err, result) => {
    if (err) {
      console.error("Trigger emergency error:", err);
      return res.status(500).json(err);
    }

    res.json({
      message: "Emergency triggered",
      event_id: result.insertId,
    });
  });
});

// ================= GET EMERGENCY HISTORY =================
router.get("/:senior_id", (req, res) => {
  const sql = `
    SELECT * 
    FROM Emergency_Event
    WHERE senior_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [req.params.senior_id], (err, result) => {
    if (err) {
      console.error("Fetch emergency error:", err);
      return res.status(500).json(err);
    }

    res.json(result);
  });
});

module.exports = router;