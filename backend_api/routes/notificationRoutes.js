const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET notifications by senior
router.get("/:senior_id", (req, res) => {

    const sql = `
        SELECT * FROM Notification
        WHERE senior_id = ?
        ORDER BY sent_timestamp DESC
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

module.exports = router;