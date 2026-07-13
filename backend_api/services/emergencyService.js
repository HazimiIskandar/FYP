// ---------------------------------------------------------------------------------
// Emergency_Event helper used by routes that POST a brand-new emergency row.
//
// All non-sensor emergency paths (SOS button press, missed check-in escalation)
// pass NO sensor_id / alert_id, leaving those FK columns NULL. Sensor-triggered
// paths (sensorRoutes.js → sensorService.processSensorAlert) supply BOTH IDs
// together — the chk_Emergency_Event_sensor_alert_pair SQL CHECK forbids
// half-populated (alert_id, sensor_id) pairs.
//
// Returns the inserted event_id via the optional callback so callers that need
// it (sensor pipeline, fan-out) don't have to re-select.
// ---------------------------------------------------------------------------------
const db = require("../config/db");

const createEmergencyEvent = (
    senior_id,
    event_type,
    escalation_level = "Level 1",
    sensor_id = null,
    alert_id = null,
    callback = null
) => {

    // Defensive client-side pairing; lets us log a clearer error than the
    // MySQL CHECK constraint when an upstream caller passes only one of the
    // two IDs by mistake.
    if ((alert_id == null) !== (sensor_id == null)) {
        const msg =
            "[emergencyService] alert_id and sensor_id must both be set or both be NULL";
        console.error(msg, { alert_id, sensor_id });
        if (typeof callback === "function") {
            callback(new Error(msg), null);
        }
        return;
    }

    const sql = `
        INSERT INTO Emergency_Event
        (senior_id, event_type, event_status, escalation_level, alert_id, sensor_id)
        VALUES (?, ?, 'Open', ?, ?, ?)
    `;

    db.query(
        sql,
        [senior_id, event_type, escalation_level, alert_id, sensor_id],
        (err, result) => {
            if (err) {
                console.log(err);
                if (typeof callback === "function") callback(err, null);
                return;
            }
            console.log("Emergency Event Created", result.insertId);
            if (typeof callback === "function") {
                callback(null, result.insertId);
            }
        }
    );
};

module.exports = {
    createEmergencyEvent
};