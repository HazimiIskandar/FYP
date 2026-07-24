const express = require("express");
const router = express.Router();
const db = require("../config/db");
const telegramService = require("../services/telegramService");

// TRIGGER EMERGENCY (manual SOS from app)
//
// Manual SOS has NO physical sensor source, so alert_id / sensor_id are left
// NULL. The CHECK constraint chk_Emergency_Event_sensor_alert_pair enforces
// the all-or-nothing rule, and event_type='SOS' tells the front-end /
// escalation engine what kind of event this is.
router.post("/trigger", (req, res) => {
  const { senior_id } = req.body;

  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  const sql = `
    INSERT INTO Emergency_Event (senior_id, event_type, event_status, escalation_level)
    VALUES (?, 'SOS', 'Open', 'Level 1')
  `;

  db.query(sql, [senior_id], (err, result) => {
    if (err) return res.status(500).json(err);

    const eventId = result.insertId;

    // Fetch the Senior's name so we can put it in the ServiceNow description
    const nameSql = `
      SELECT ua.full_name 
      FROM Senior s 
      JOIN User_Account ua ON s.user_id = ua.user_id 
      WHERE s.senior_id = ?
    `;
    
    db.query(nameSql, [senior_id], (nameErr, nameResult) => {
      let seniorName = "Unknown Senior";
      if (!nameErr && nameResult.length > 0) {
        seniorName = nameResult[0].full_name;
      }

      // Fire-and-forget: Send the SOS alert to Telegram
      setImmediate(() => {
        telegramService.notifyCheckIn(senior_id, {
          seniorFullName: seniorName,
          eventType: "SOS",
          imOkay: false
        }).catch(e => console.error("Telegram SOS trigger failed:", e));
      });
    });

    res.json({
      message: "Emergency triggered",
      event_id: eventId
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

// CAREGIVER ACTION (Trigger Missed check-in workflow)
router.post("/caregiver-action", (req, res) => {
  const { senior_name } = req.body;

  if (!senior_name) {
    return res.status(400).json({ error: "senior_name is required" });
  }

  // No longer using ServiceNow to update incident to In Progress

  res.json({
    message: "Caregiver action triggered",
  });
});

module.exports = router;