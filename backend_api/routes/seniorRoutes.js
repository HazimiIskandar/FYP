const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", (req, res) => {
  db.query("SELECT * FROM Senior", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.get("/:senior_id/details", (req, res) => {
  const sql = `
    SELECT 
      s.*,
      r.current_streak,
      r.total_points
    FROM Senior s
    LEFT JOIN Reward_Streak r
      ON s.senior_id = r.senior_id
    WHERE s.senior_id = ?
  `;

  db.query(sql, [req.params.senior_id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results[0] || null);
  });
});

router.get("/:senior_id/medical-conditions", (req, res) => {

  const sql = `
    SELECT
      mc.condition_id,
      mc.condition_name,
      mc.severity_level,
      mc.medication_required,
      mc.notes,
      smc.diagnosed_date
    FROM Senior_Medical_Condition smc
    JOIN Medical_Condition mc
      ON smc.condition_id = mc.condition_id
    WHERE smc.senior_id = ?
  `;

  db.query(sql, [req.params.senior_id], (err, results) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(results);
  });
});

router.get("/:senior_id", (req, res) => {
  db.query(
    "SELECT * FROM Senior WHERE senior_id = ?",
    [req.params.senior_id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results[0] || null);
    }
  );
});

router.post("/", (req, res) => {
  const { full_name, age, gender, address, phone_number } = req.body;
  if (!full_name) {
    return res.status(400).json({ error: "full_name is required" });
  }

  const sql = `
    INSERT INTO Senior
    (full_name, age, gender, address, phone_number)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [full_name, age, gender, address, phone_number],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ message: "Senior created successfully", senior_id: result.insertId });
    }
  );
});

module.exports = router;
