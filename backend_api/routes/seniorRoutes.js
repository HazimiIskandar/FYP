const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET ALL SENIORS (Roster/List)
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
    ORDER BY senior_id ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).json(err);
    }
    res.json(results);
  });
});

// GET SINGLE SENIOR
router.get("/:senior_id", (req, res) => {
  db.query(
    `SELECT senior_id, full_name, age, gender, unit_number, phone_number 
     FROM Senior 
     WHERE senior_id = ?`,
    [req.params.senior_id],
    (err, results) => {
      if (err) {
        console.log("DB ERROR:", err);
        return res.status(500).json(err);
      }
      res.json(results[0] || null);
    }
  );
});

module.exports = router;