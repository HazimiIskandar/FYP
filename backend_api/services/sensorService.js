// ---------------------------------------------------------------------------------
// Sensor alert pipeline.
//
// When a physical sensor pushes an ALERT (e.g. fall detection, motion
// anomaly, door sensor), we coordinate three back-end writes:
//   1. Sensor_Alert row    (alert_id AUTO_INCREMENT)
//   2. Emergency_Event row  (carries the SAME sensor_id + alert_id, so the
//                            composite FK on Emergency_Event is satisfied)
//   3. Notification row     (audit; recipient_type='aic', event_id set,
//                            checkin_id/alert_id/sensor_id left NULL because
//                            notification FKs to exactly one source)
//
// Failure-mode compensation
//   If step 2 (Emergency_Event) fails AFTER step 1 (Sensor_Alert) has already
//   committed, the Sensor_Alert row would otherwise be orphaned (no event row
//   to back-reference). processSensorAlert compensates by deleting the orphan
//   alert row when the event insert errors out. Notification (step 3) is a
//   soft failure - the audit row is fire-and-forget; if it fails the alert and
//   event rows still represent reality.
// ---------------------------------------------------------------------------------
const db = require("../config/db");
const { createEmergencyEvent } = require("./emergencyService");
const { createNotification } = require("./notificationService");

// Map common sensor_status strings to the canonical event_type string stored
// in Emergency_Event.event_type. Falls back to 'Sensor Alert' for anything
// we don't recognise.
function classifyEvent(sensorType, sensorStatus) {
    const st = String(sensorType || "").toLowerCase();
    const ss = String(sensorStatus || "").toLowerCase();
    if (st.includes("fall") || ss.includes("fall")) return "Fall Detected";
    if (ss.includes("alert") || ss.includes("critical")) return "Sensor Alert";
    return "Sensor Alert";
}

function insertSensorAlert(alert_type, message, sensor_id, onInserted) {
    const sql = `
        INSERT INTO Sensor_Alert (alert_type, message, sensor_id)
        VALUES (?, ?, ?)
    `;
    db.query(sql, [alert_type, message, sensor_id], (err, result) => {
        if (err) {
            console.warn("[sensorService] Sensor_Alert insert failed:", err.message || err);
            if (typeof onInserted === "function") onInserted(null, err);
            return;
        }
        if (typeof onInserted === "function") {
            onInserted(result.insertId, null);
        }
    });
}

// Compensating delete: removes an orphan Sensor_Alert row by its composite PK.
function deleteOrphanAlert(alert_id, sensor_id) {
    if (alert_id == null || sensor_id == null) return;
    db.query(
        "DELETE FROM Sensor_Alert WHERE alert_id = ? AND sensor_id = ?",
        [alert_id, sensor_id],
        (delErr) => {
            if (delErr) {
                console.warn(
                    "[sensorService] orphan Sensor_Alert row could not be cleaned up:",
                    delErr.message || delErr
                );
            } else {
                console.warn(
                    "[sensorService] orphan Sensor_Alert deleted (alert_id=" +
                    alert_id + ", sensor_id=" + sensor_id + ")"
                );
            }
        }
    );
}

// Top-level entry point called by sensorRoutes on an ALERT payload.
//
// Expected payload (envelope):
//   {
//     senior_id:    <required>,
//     sensor_id:    <required, the physical sensor row's id>,
//     sensor_type:  <e.g. "Fall", "Motion", "Door">,
//     sensor_value: <string or numeric reading>,
//     sensor_status:"ALERT",
//     message:      <optional human-readable override>
//   }
function processSensorAlert(payload, onDone) {
    if (!payload || typeof payload !== "object") {
        const msg = "[sensorService] processSensorAlert: payload missing";
        console.warn(msg);
        if (typeof onDone === "function") onDone({ ok: false, error: msg });
        return;
    }
    const {
        senior_id,
        sensor_id,
        sensor_type,
        sensor_value,
        sensor_status,
        message,
    } = payload;

    if (!senior_id) {
        const msg = "[sensorService] processSensorAlert: senior_id required";
        console.warn(msg);
        if (typeof onDone === "function") onDone({ ok: false, error: msg });
        return;
    }
    if (!sensor_id) {
        const msg = "[sensorService] processSensorAlert: sensor_id required for sensor source";
        console.warn(msg);
        if (typeof onDone === "function") onDone({ ok: false, error: msg });
        return;
    }

    const eventType = classifyEvent(sensor_type, sensor_status);
    const alertMessage =
        (message && String(message).trim()) ||
        `Sensor ${sensor_type || "alert"} reported ${sensor_status || "ALERT"} ` +
            `(value=${sensor_value ?? "n/a"}) for senior ${senior_id}`;

    // Step 1: Sensor_Alert
    insertSensorAlert(eventType, alertMessage, sensor_id, (alert_id, alertErr) => {
        if (alertErr || !alert_id) {
            if (typeof onDone === "function") {
                onDone({ ok: false, error: "Sensor_Alert insert failed" });
            }
            return;
        }

        // Step 2: Emergency_Event with the SAME sensor_id + alert_id so the
        // all-or-nothing CHECK constraint and the composite FK both pass.
        createEmergencyEvent(
            senior_id,
            eventType,
            "Level 1",
            sensor_id,
            alert_id,
            (evtErr, event_id) => {
                if (evtErr || !event_id) {
                    // Compensate: delete the orphan Sensor_Alert so the audit
                    // trail doesn't claim an event that doesn't exist.
                    deleteOrphanAlert(alert_id, sensor_id);
                    if (typeof onDone === "function") {
                        onDone({ ok: false, error: "Emergency_Event insert failed" });
                    }
                    return;
                }

                // Step 3: Notification audit row (event_id branch of
                // chk_Notification_one_link; checkin_id / alert_id / sensor_id
                // are NULL because the Notification FK chain follows event_id).
                // createNotification is contractually non-throwing (it logs and
                // returns), so no try/catch is needed here.
                createNotification(
                    "aic",
                    "AIC Staff",
                    senior_id,
                    event_id,
                    null // checkin_id
                );

                console.log(
                    "[sensorService] chain OK senior=" + senior_id +
                    " sensor=" + sensor_id +
                    " alert=" + alert_id +
                    " event=" + event_id +
                    " type=" + eventType
                );
                if (typeof onDone === "function") {
                    onDone({
                        ok: true,
                        alert_id,
                        event_id,
                        event_type: eventType,
                    });
                }
            }
        );
    });
}

module.exports = {
    processSensorAlert,
    classifyEvent,
};
