const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { triggerCheckIn } = require("../services/servicenow");

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
// Helper to wrap db.query in a Promise
const queryAsync = (sql, params) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
    });
});

const escalateCheckIn = async (senior_id, timeOfDay = 'Morning') => {
    const eventType = `Missed ${timeOfDay} Check-In`;
    
    const dedupeSql = `
        SELECT event_id
        FROM Emergency_Event
        WHERE senior_id = ?
          AND event_type = ?
          AND DATE(created_at) = CURDATE()
        LIMIT 1
    `;

    try {
        const dedupeRows = await queryAsync(dedupeSql, [senior_id, eventType]);

        // A Missed Check-In event already exists for this senior today for this time block.
        // Skip so we don't spam the database every 10 minutes.
        if (Array.isArray(dedupeRows) && dedupeRows.length > 0) {
            return;
        }

        const createEvent = `
            INSERT INTO Emergency_Event
            (senior_id, event_type, event_status, escalation_level)
            VALUES (?, ?, 'Open', 'Level 1')
        `;

        const result = await queryAsync(createEvent, [senior_id, eventType]);
        const event_id = result.insertId;
        console.log(`Level 1 Emergency created (${eventType})`, event_id);

        logEscalation(event_id, "Caregiver App", "Level 1");
        
        // Automatically push this missed check-in to ServiceNow
        triggerCheckIn(senior_id, eventType, false).catch(e => 
            console.error("ServiceNow trigger failed:", e)
        );

        setTimeout(() => {
            escalateLevel(event_id, senior_id, "Level 2 - Staff Alert");
        }, 10000);
    } catch (err) {
        console.error("Escalation failed:", err);
    }
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

const monitorCheckIns = async () => {
    try {
        // 1. Fetch all Seniors and their check-in times
        const seniorsSql = `
            SELECT s.senior_id, s.preferred_checkin_time 
            FROM Senior s
            JOIN User_Account u ON s.senior_id = u.user_id
            WHERE u.role = 'Senior'
        `;
        const seniors = await queryAsync(seniorsSql);

        // 2. Fetch today's check-ins for ALL seniors
        const checkinsSql = `
            SELECT senior_id, HOUR(checkin_timestamp) as chk_hour
            FROM Daily_CheckIn
            WHERE DATE(checkin_timestamp) = CURDATE()
        `;
        const checkins = await queryAsync(checkinsSql);

        // Group checkins by senior to see if they checked in during the Morning (<16) or Evening (>=16)
        const seniorCheckins = {};
        checkins.forEach(c => {
            if (!seniorCheckins[c.senior_id]) seniorCheckins[c.senior_id] = { morning: false, evening: false };
            if (c.chk_hour < 16) seniorCheckins[c.senior_id].morning = true;
            else seniorCheckins[c.senior_id].evening = true;
        });

        const currentHour = new Date().getHours();

        // 3. Process sequentially to prevent DB Queue Limit Reached errors
        for (const senior of seniors) {
            let timeStr = senior.preferred_checkin_time || '6:00 AM - 12:00 PM';
            
            // Parse the start time from the string
            let morningHour = 6;
            const match = timeStr.match(/(\d{1,2}):\d{2}\s*(AM|PM)/i);
            if (match) {
                morningHour = parseInt(match[1]);
                if (match[2].toUpperCase() === 'PM' && morningHour < 12) morningHour += 12;
                if (match[2].toUpperCase() === 'AM' && morningHour === 12) morningHour = 0;
            }

            // Calculate exact deadlines (2-hour grace period)
            const eveningHour = (morningHour + 12) % 24;
            const morningDeadline = morningHour + 2;
            const eveningDeadline = eveningHour + 2;

            const hasMorning = seniorCheckins[senior.senior_id]?.morning;
            const hasEvening = seniorCheckins[senior.senior_id]?.evening;

            // Escalate Morning if past deadline and no check-in
            if (currentHour >= morningDeadline && !hasMorning) {
                console.log(`[ESCALATION] Senior ${senior.senior_id} missed Morning Check-in. Deadline was ${morningDeadline}:00.`);
                await escalateCheckIn(senior.senior_id, 'Morning');
            }

            // Escalate Evening if past deadline and no check-in
            if (currentHour >= eveningDeadline && !hasEvening) {
                console.log(`[ESCALATION] Senior ${senior.senior_id} missed Evening Check-in. Deadline was ${eveningDeadline}:00.`);
                await escalateCheckIn(senior.senior_id, 'Evening');
            }
        }
    } catch (err) {
        console.error("Monitor Checkins crashed:", err);
    }
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
