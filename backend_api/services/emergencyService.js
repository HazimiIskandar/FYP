const db = require("../config/db");

const createEmergencyEvent = (
    senior_id,
    event_type,
    escalation_level = "Level 1"
) => {

    const sql = `
        INSERT INTO Emergency_Event
        (senior_id, event_type, event_status, escalation_level)
        VALUES (?, ?, 'Open', ?)
    `;

    db.query(
        sql,
        [senior_id, event_type, escalation_level],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                console.log("Emergency Event Created");
            }
        }
    );
};

module.exports = {
    createEmergencyEvent
};