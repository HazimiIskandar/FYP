const express = require("express");
const db = require("../config/db");

const router = express.Router();

/**
 * GET /community/activities/all
 * Fetch all community hub activities for all seniors
 */
router.get("/activities/all", (req, res) => {
  const query = `
    SELECT 
      activity_id,
      senior_id,
      activity_name,
      activity_type,
      activity_date,
      participation_status
    FROM Community_Hub
    ORDER BY activity_date DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching all community activities:", err);
      return res.status(500).json({ error: "Failed to fetch activities" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/**
 * GET /community/activities/:senior_id
 * Fetch all community hub activities for a senior
 */
router.get("/activities/:senior_id", (req, res) => {
  const { senior_id } = req.params;

  // Skip if trying to fetch 'all'
  if (senior_id === 'all') {
    return res.next?.();
  }

  const query = `
    SELECT 
      activity_id,
      senior_id,
      activity_name,
      activity_type,
      activity_date,
      participation_status
    FROM Community_Hub
    WHERE senior_id = ?
    ORDER BY activity_date DESC
  `;

  db.query(query, [senior_id], (err, results) => {
    if (err) {
      console.error("Error fetching community activities:", err);
      return res.status(500).json({ error: "Failed to fetch activities" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/**
 * POST /community/record-activity
 * Record a community game completion for a senior
 * Body: { senior_id, activity_name, activity_type, participation_status }
 */
router.post("/record-activity", (req, res) => {
  const { senior_id, activity_name = "Memory Game", activity_type = "Game", participation_status = "Completed" } = req.body;

  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  const query = `
    INSERT INTO Community_Hub (senior_id, activity_name, activity_type, activity_date, participation_status)
    VALUES (?, ?, ?, NOW(), ?)
  `;

  db.query(query, [senior_id, activity_name, activity_type, participation_status], (err, results) => {
    if (err) {
      console.error("Error recording activity:", err);
      return res.status(500).json({ error: "Failed to record activity" });
    }
    res.json({ success: true, activity_id: results.insertId });
  });
});

module.exports = router;
