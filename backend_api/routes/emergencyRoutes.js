const express = require("express");
const router = express.Router();
const db = require("../config/db");

// TRIGGER EMERGENCY 
router.post("/trigger", (req, res) => {
    const { senior_id } = req.body;

    const sql = `
        INSERT INTO Emergency_Event (senior_id, event_type, event_status, escalation_level)
        VALUES (?, 'SOS', 'Open', 'Level 1')
    `;

    db.query(sql, [senior_id], (err, result) => {
        if (err) return res.send(err);

        res.send("Emergency triggered");
    });
});


// GET EMERGENCY HISTORY 
router.get("/:senior_id", (req, res) => {

    const sql = `
        SELECT * FROM Emergency_Event
        WHERE senior_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

module.exports = router;