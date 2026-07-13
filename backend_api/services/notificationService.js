// ---------------------------------------------------------------------------------
// Notification audit-row writer.
//
// Each row records that an outbound alert was dispatched and which source
// generated it. Exactly ONE of {event_id, checkin_id, alert_id} MUST be set,
// enforced by the CHECK constraint chk_Notification_one_link at the DB level;
// this function enforces the same invariant client-side so we log a clearer
// error than a generic CHECK-violation if a caller slips up.
//
// Recipient audit columns
//   recipient_type: free-form, e.g. 'caregiver', 'nok', 'aic', 'all', or one
//                   of the bucket names consumed by telegramRecipients
//                   (currently 'caregiver_nok_aic' | 'caregiver_aic').
//   recipient_name: human-readable name, primarily used in the audit row
//                   (the actual sink picks the full recipient list).
//
// Sensor / Alert columns
//   alert_id + sensor_id are always written together (composite FK to
//   Sensor_Alert). They can stay NULL when the notification is sourced from
//   a Daily_CheckIn or an Emergency_Event.
// ---------------------------------------------------------------------------------

const db = require("../config/db");

const createNotification = (
    recipient_type,
    recipient_name,
    senior_id,
    event_id = null,
    checkin_id = null,
    alert_id = null,
    sensor_id = null
) => {

    // Exactly-one-link invariant. The DB CHECK is the source of truth, but a
    // client-side guard saves a round trip and lets us log a useful message.
    const linksSet =
        Number(event_id != null) +
        Number(checkin_id != null) +
        Number(alert_id != null);

    if (linksSet !== 1) {
        console.warn(
            "[notificationService] exactly one of event_id / checkin_id / " +
            "alert_id must be set (got " + linksSet + "). Skipping insert.",
            { event_id, checkin_id, alert_id }
        );
        return;
    }

    // alert_id + sensor_id must move as a pair (NULL together or both set).
    if ((alert_id == null) !== (sensor_id == null)) {
        console.warn(
            "[notificationService] alert_id and sensor_id must both be set or both be NULL.",
            { alert_id, sensor_id }
        );
        return;
    }

    const sql = `
        INSERT INTO Notification
        (
            recipient_type,
            recipient_name,
            notification_status,
            senior_id,
            event_id,
            checkin_id,
            alert_id,
            sensor_id
        )
        VALUES (?, ?, 'Sent', ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            recipient_type,
            recipient_name,
            senior_id,
            event_id,
            checkin_id,
            alert_id,
            sensor_id,
        ],
        (err, result) => {
            if (err) {
                console.log(err);
            } else {
                console.log("Notification created", result && result.insertId);
            }
        }
    );
};

module.exports = {
    createNotification
};
