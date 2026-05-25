const db = require("../config/db");

// ESCALATION ENGINE
const escalateCheckIn = (senior_id) => {
    const createEvent = `
        INSERT INTO Emergency_Event 
        (senior_id, event_type, event_status, escalation_level)
        VALUES (?, 'Missed Check-In', 'Open', 'Level 1')
    `;

    db.query(createEvent, [senior_id], (err, result) => {
        if (err) return console.log(err);

        const event_id = result.insertId;

        console.log("Level 1 Emergency created");

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

    db.query(updateEvent, [level, event_id]);

    logEscalation(event_id, "System Auto Escalation", level);

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

    db.query(sql, [event_id, escalated_to, level]);
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

// IMPORTANT: only export functions
module.exports = {
    escalateCheckIn,
    monitorCheckIns
};