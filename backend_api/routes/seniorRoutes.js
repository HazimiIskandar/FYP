const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", (req, res) => {
  db.query("SELECT * FROM Senior", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.get("/:senior_id", (req, res) => {
  db.query(
    "SELECT * FROM Senior WHERE senior_id = ?",
    [req.params.senior_id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

module.exports = router;
