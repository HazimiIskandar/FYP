const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", (req, res) => {
  const sql = `
    SELECT 
      senior_id,
      full_name,
      age,
      gender,
      unit_number,
      phone_number
    FROM Senior
  `;

  db.query(sql, (err, results) => {
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
