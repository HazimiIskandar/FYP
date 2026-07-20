const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ESCALATION ENGINE
//
// A missed check-in is a SYSTEM-triggered event with NO physical sensor
// source, so alert_id / sensor_id stay NULL. event_type='Missed Check-In'
// distinguishes it from manual SOS and from real sensor alerts.
//
// De-duplication: monitorCheckIns runs every 10 minutes via server.js's
// setInterval, and previously escalated UNCONDITIONALLY on each tick —
// producing ~144 Emergency_Event rows per senior per missed day and
// ballooning the AIC portal past 8,000 cases. We now SELECT-first and
// skip INSERT if a Missed Check-In row already exists for the same
// senior today. The check covers any event_status (Open, Resolved, etc.)
// because re-opening or re-throttling an escalation on the same day
// is never the desired behavior at the system level — the caregiver
// or AIC staff must explicitly close out and re-trigger via the
// existing Escalation_Assignment pathway if they want to re-engage.
//
// Timezone dependency: `DATE(created_at) = CURDATE()` looks like a
// cross-timezone bug at first glance, but it is NOT. `config/db.js`
// forces every pooled connection to `SET time_zone = '+08:00'` so
// `created_at` (CURRENT_TIMESTAMP) and CURDATE() are both evaluated
// in SGT. Do NOT "fix" this by swapping to `UTC_DATE()` without
// auditing the senior-local-day boundary semantics — that change
// would split a 23:00 SGT missed check-in into the wrong escalation
// bucket.
//
// Concurrency note: the SELECT-then-INSERT has a tiny race window, but
// server.js currently runs a single Node process / single setInterval,
// so the window cannot fire today. If the backend is ever scaled
// horizontally, this de-dup should be promoted to a DB-level
// UNIQUE (senior_id, event_type, DATE(created_at)) constraint via a
// migration — deferring that until scale forces it.
const escalateCheckIn = (senior_id) => {
    const dedupeSql = `
        SELECT event_id
        FROM Emergency_Event
        WHERE senior_id = ?
          AND event_type = 'Missed Check-In'
          AND DATE(created_at) = CURDATE()
        LIMIT 1
    `;

    db.query(dedupeSql, [senior_id], (dedupeErr, dedupeRows) => {
        if (dedupeErr) {
            console.error("Escalation dedupe check failed:", dedupeErr);
            return;
        }

        // A Missed Check-In event already exists for this senior today
        // (any status). Skip — the caregiver / AIC flow drives re-open
        // explicitly, not silently via a fresh row every 10 minutes.
        if (Array.isArray(dedupeRows) && dedupeRows.length > 0) {
            return;
        }

        const createEvent = `
            INSERT INTO Emergency_Event
            (senior_id, event_type, event_status, escalation_level)
            VALUES (?, 'Missed Check-In', 'Open', 'Level 1')
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
