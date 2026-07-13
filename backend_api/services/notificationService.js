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
        // The `[notification] SKIP:` prefix lives ONLY in the log line; the
        // Error message stays self-describing so when dispatchEngagement
        // surfaces it as `reason=...`, we don't see a duplicated tag.
        const reason =
            "linksSet invariant violation: exactly one of event_id / " +
            "checkin_id / alert_id must be set (got " + linksSet + ")";
        console.warn(
            "[notification] SKIP: " + reason,
            { event_id, checkin_id, alert_id }
        );
        // Returning a resolved Promise keeps dispatchEngagement's settle
        // shape consistent across all code paths so its per-sink logs always
        // surface a useful `.value.error` instead of falling through to
        // `reason=unknown`.
        return Promise.resolve({
            ok: false,
            insertId: null,
            error: new Error(reason),
        });
    }

    // alert_id + sensor_id must move as a pair (NULL together or both set).
    if ((alert_id == null) !== (sensor_id == null)) {
        const reason =
            "alert_id / sensor_id pairing violation: must both be set or both be NULL";
        console.warn("[notification] SKIP: " + reason, { alert_id, sensor_id });
        return Promise.resolve({
            ok: false,
            insertId: null,
            error: new Error(reason),
        });
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

    // Returns a Promise so callers (notably notificationFanout.js) can await
    // the actual INSERT completion via Promise.allSettled. Without this wrap,
    // the db.query callback was orphaned: Promise.resolve(createNotification(...))
    // resolved to `undefined` immediately, and any failure (FK violation,
    // connection drop, pool exhaustion) was just printed via console.log and
    // never surfaced. We resolve UNCONDITIONALLY on both success and failure
    // so Promise.allSettled always settles — the caller inspects `.value.ok`
    // and `.value.error` instead of relying on rejection.
    return new Promise((resolve) => {
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
                    console.warn(
                        "[notification] FAIL senior_id=" + String(senior_id) +
                        " checkin_id=" + String(checkin_id) +
                        " event_id=" + String(event_id) +
                        " err=" + ((err && err.message) || String(err))
                    );
                    return resolve({ ok: false, insertId: null, error: err });
                }
                console.log(
                    "[notification] OK id=" + (result && result.insertId) +
                    " senior_id=" + String(senior_id) +
                    " checkin_id=" + String(checkin_id)
                );
                return resolve({
                    ok: true,
                    insertId: (result && Number(result.insertId)) || null,
                    error: null,
                });
            }
        );
    });
};

module.exports = {
    createNotification
};
