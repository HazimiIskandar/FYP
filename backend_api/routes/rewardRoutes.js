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

router.post("/redeem", (req, res) => {
  const { senior_id, reward_name } = req.body;
  if (!senior_id || !reward_name) {
    return res.status(400).json({ error: "senior_id and reward_name are required" });
  }

  const sql = `
    UPDATE Reward_Streak
    SET reward_redeemed = ?, redemption_date = NOW()
    WHERE senior_id = ?
  `;

  db.query(sql, [reward_name, senior_id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Reward redeemed successfully" });
  });
});

module.exports = router;
