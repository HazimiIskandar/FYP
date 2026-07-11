const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ESCALATION ENGINE
const escalateCheckIn = (senior_id) => {
    // Schema note: Emergency_Event does NOT have an `event_type` column
    // (see SQL Update 4-7.sql). We fold the event description into
    // `escalation_level` instead — e.g. "Level 1 — Missed Check-In".
    const createEvent = `
        INSERT INTO Emergency_Event
        (senior_id, event_status, escalation_level)
        VALUES (?, 'Open', 'Level 1 — Missed Check-In')
    `;

    db.query(createEvent, [senior_id], (err, result) => {
        if (err) {
            console.error("Escalation creation failed:", err);
            return;
        }

        const event_id = result.insertId;
        console.log("Level 1 Emergency created", event_id);

        logEscalation(event_id, "Caregiver App", "Level 1");

        setTimeout(() => {
            escalateLevel(event_id, senior_id, "Level 2 - Staff Alert");
        }, 10000);
    });
};

const escalateLevel = (event_id, senior_id, level) => {
    const updateEvent = `
        UPDATE Emergency_Event
        SET escalation_level = ?
        WHERE event_id = ?
    `;

    db.query(updateEvent, [level, event_id], (err) => {
        if (err) return console.error("Escalation update failed:", err);
        logEscalation(event_id, "System Auto Escalation", level);
    });

    if (level === "Level 2 - Staff Alert") {
        setTimeout(() => {
            escalateLevel(event_id, senior_id, "Level 3 - Emergency Services");
        }, 10000);
    }
};

const logEscalation = (event_id, escalated_to, level) => {
    const sql = `
        INSERT INTO Escalation_History
        (event_id, escalated_to, escalation_status)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [event_id, escalated_to, level], (err) => {
        if (err) console.error("Escalation history log failed:", err);
    });
};

const monitorCheckIns = () => {
    const sql = `
        SELECT s.senior_id
        FROM Senior s
        LEFT JOIN Daily_CheckIn d
        ON s.senior_id = d.senior_id
        AND DATE(d.checkin_timestamp) = CURDATE()
        WHERE d.checkin_id IS NULL
    `;

    db.query(sql, (err, results) => {
        if (err) return console.log(err);

        results.forEach((senior) => {
            console.log("Missed check-in:", senior.senior_id);
            escalateCheckIn(senior.senior_id);
        });
    });
};

router.post("/trigger/:senior_id", (req, res) => {
    const { senior_id } = req.params;
    if (!senior_id) {
        return res.status(400).json({ error: "senior_id is required" });
    }

    escalateCheckIn(senior_id);
    res.json({ message: `Escalation triggered for senior_id ${senior_id}` });
});

router.get("/history/:event_id", (req, res) => {
    const sql = `
        SELECT * FROM Escalation_History
        WHERE event_id = ?
    `;

    db.query(sql, [req.params.event_id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

module.exports = router;
module.exports.monitorCheckIns = monitorCheckIns;
