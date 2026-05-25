const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", (req, res) => {
  db.query("SELECT * FROM Reward_Streak", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.get("/senior/:senior_id", (req, res) => {
  db.query(
    "SELECT * FROM Reward_Streak WHERE senior_id = ?",
    [req.params.senior_id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

module.exports = router;
