const db = require("../config/db");

const createEmergencyEvent = (
    senior_id,
    event_type,
    escalation_level = "Level 1"
) => {
    // Schema note: Emergency_Event does NOT have an `event_type` column
    // (see SQL Update 4-7.sql). We fold the event description into
    // `escalation_level` instead — e.g. "Level 1 — Missed Check-In".
    // Callers may still pass `event_type` as a separate semantic label
    // (kept in the function signature for backwards compatibility) but
    // the DB now stores it appended to escalation_level.
    //
    // Defensive trim: escalation_level is VARCHAR(50), so clamp the
    // merged string so MySQL never silently truncates (or errors
    // under STRICT_ALL_TABLES).
    const mergedLevel = `${escalation_level} — ${event_type}`.slice(0, 50);

    const sql = `
        INSERT INTO Emergency_Event
        (senior_id, event_status, escalation_level)
        VALUES (?, 'Open', ?)
    `;

    db.query(
        sql,
        [senior_id, mergedLevel],
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