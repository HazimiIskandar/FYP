const express = require("express");
const router = express.Router();
const db = require("../config/db");
const telegramService = require("../services/telegramService");
const { getCurrentSgtHour, nowUtcDateTime } = require("../utils/time");
const servicenow = require("../services/servicenow");
const { getEmailRecipientsForWorkflowRoute } = require("../emailRecipients");
const { sendCheckInEmailToAllCaregivers } = require("../services/emailService");

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

        const assignedStaffIds = await getAssignedAicStaffIdsForSenior(senior_id);
        logEscalation(event_id, "Caregiver App", "Level 1", {
            assignStaffIds: assignedStaffIds,
        });
        
        // Fetch senior's full name and caregiver emails for ServiceNow + email notifications
        const seniorInfoRows = await queryAsync(
            `SELECT ua.full_name FROM Senior s JOIN User_Account ua ON ua.user_id = s.user_id WHERE s.senior_id = ? LIMIT 1`,
            [senior_id]
        );
        const seniorFullName = (seniorInfoRows && seniorInfoRows[0] && seniorInfoRows[0].full_name) || "Senior " + senior_id;

        const recipients = await getEmailRecipientsForWorkflowRoute("caregiver_aic", senior_id).catch(() => []);
        const caregiverEmails = recipients.filter(r => r.role === "caregiver").map(r => r.email);
        const caregiverCount = caregiverEmails.length;
        const caregiverEmailStr = caregiverEmails.join(",");

        // Determine workflow route based on linked contacts
        const nokCountRows = await queryAsync(
            `SELECT COUNT(*) AS n FROM Senior_has_NOK WHERE senior_id = ?`,
            [senior_id]
        ).catch(() => [{ n: 0 }]);
        const nokCount = (nokCountRows && nokCountRows[0] && Number(nokCountRows[0].n)) || 0;
        const workflowRoute = nokCount > 0 ? "caregiver_nok_aic" : "caregiver_aic";

        const checkinTimestamp = nowUtcDateTime();

        // Fire all notification sinks in parallel: Telegram + ServiceNow + Email
        Promise.allSettled([
            // Telegram notification
            telegramService.notifyCheckIn(senior_id, {
                seniorFullName: seniorFullName,
                eventType,
                imOkay: false,
                checkinTimestamp
            }).catch(e => console.error("[escalation] Telegram failed:", e)),

            // ServiceNow u_checkin_response record
            servicenow.createCheckInResponse({
                senior_id: senior_id,
                senior_full_name: seniorFullName,
                checkin_timestamp: checkinTimestamp,
                event_type: "Missed Check-In",
                im_okay: false,
                workflow_route: workflowRoute,
                caregiver_count: caregiverCount,
                nok_count: nokCount,
                aic_staff_count: aicCount,
                caregiver_email: caregiverEmailStr,
            }).catch(e => console.error("[escalation] ServiceNow failed:", e)),

            // Email all linked caregivers directly
            sendCheckInEmailToAllCaregivers({
                recipients: recipients,
                seniorName: seniorFullName,
            }).catch(e => console.error("[escalation] Email failed:", e)),
        ]).then(() => {
            console.log(`[escalation] Notifications dispatched for ${eventType} senior_id=${senior_id}`);
        });

        setTimeout(() => {
            escalateLevel(event_id, senior_id, "Level 2 - Staff Alert");
        }, 10000);
    } catch (err) {
        console.error("Escalation failed:", err);
    }
};

const escalateLevel = (event_id, senior_id, level) => {
    // Escalation-ladder guard. `escalateCheckIn` schedules Level-2 and
    // Level-3 updates via setTimeout(..., 10000). If the senior checks in
    // inside that 20-second window, the new resolveMissedSql in
    // checkInRoutes.js flips `event_status` to 'Resolved' but the
    // already-queued setTimeout callbacks still fire. Without this guard
    // every late-arriving timer would overwrite `escalation_level`
    // ('Level 3 - Emergency Services') on a row that is now 'Resolved',
    // cluttering reports and confusing operators who look at the case
    // later. SELECT-then-update keeps the existing ladder cheap while
    // making the late callbacks a silent no-op.
    const statusGuardSql = `
        SELECT event_status
        FROM Emergency_Event
        WHERE event_id = ?
        LIMIT 1
    `;

    db.query(statusGuardSql, [event_id], (guardErr, guardRows) => {
        if (guardErr) {
            console.error("Escalation status guard failed:", guardErr);
            return;
        }
        const currentStatus = String(((guardRows || [])[0] || {}).event_status || '');
        if (/^(resolved|closed|cancelled)$/i.test(currentStatus)) {
            console.log(
                `[ESCALATION] Skipping level=${level} for already-settled event_id=${event_id} (status=${currentStatus})`
            );
            return;
        }

        const updateEvent = `
            UPDATE Emergency_Event
            SET escalation_level = ?
            WHERE event_id = ?
        `;

        db.query(updateEvent, [level, event_id], (err) => {
            if (err) return console.error("Escalation update failed:", err);
            logEscalation(event_id, "System Auto Escalation", level);
        });
    });

    if (level === "Level 2 - Staff Alert") {
        setTimeout(() => {
            escalateLevel(event_id, senior_id, "Level 3 - Emergency Services");
        }, 10000);
    }
};

const assignEscalationToSeniorAicStaff = async (escalationId, senior_id) => {
    if (!escalationId || !senior_id) return;

    try {
        const staffRows = await queryAsync(
            `SELECT staff_id FROM Senior_has_AIC_Staff WHERE senior_id = ?`,
            [senior_id]
        );

        const assignedStaffIds = (Array.isArray(staffRows) ? staffRows : [])
            .map((row) => Number(row.staff_id))
            .filter((id) => Number.isFinite(id));

        if (assignedStaffIds.length === 0) return assignedStaffIds;

        return assignedStaffIds;
    } catch (err) {
        console.error("Failed to fetch assigned AIC staff for senior_id=" + senior_id + ":", err.message || err);
        return [];
    }
};

const logEscalation = (event_id, escalated_to, level, options = {}) => {
    const sql = `
        INSERT INTO Escalation_History
        (event_id, escalated_to, escalation_status)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [event_id, escalated_to, level], (err, result) => {
        if (err) {
            console.error("Escalation history log failed:", err);
            return;
        }

        if (
            options.assignStaffIds &&
            Array.isArray(options.assignStaffIds) &&
            options.assignStaffIds.length > 0
        ) {
            const escalationId = result && result.insertId;
            if (!escalationId) return;

            const values = options.assignStaffIds
                .map((staffId) => Number(staffId))
                .filter((id) => Number.isFinite(id))
                .map((staffId) => [staffId, escalationId]);

            if (values.length === 0) return;

            const insertAssignmentSql = `
                INSERT IGNORE INTO Escalation_Assignment
                (staff_id, escalation_id)
                VALUES ?
            `;

            db.query(insertAssignmentSql, [values], (assignErr) => {
                if (assignErr) {
                    console.error("Escalation assignment failed:", assignErr.message || assignErr);
                }
            });
        }
    });
};

const monitorCheckIns = async () => {
    try {
        // Escalation window length (hours) for each check-in block.
        const ESCALATION_WINDOW_HOURS = 8;

        // Returns true once `windowHours` have elapsed from `startHour`,
        // handling midnight wrap (e.g. 18:00 + 8h => 02:00 next day).
        const hasWindowElapsed = (nowHour, startHour, windowHours) => {
            const elapsed = (nowHour - startHour + 24) % 24;
            return elapsed >= windowHours;
        };

        const formatHourLabel = (hour24) => `${((hour24 % 24) + 24) % 24}:00`;

        // 1. Fetch all Seniors and their check-in times.
        // NOTE: previously joined on `s.senior_id = u.user_id`, which is
        // structurally impossible (Senior.senior_id is the senior PK and
        // Senior.user_id is the FK to User_Account.user_id). The broken
        // join made `.some()` against the result always false, so the cron
        // escalation NEVER fired — every missed check-in either required a
        // manual `/escalation/trigger/:senior_id` POST or remained
        // permanently undetected. Joining on `s.user_id = u.user_id` is
        // the correct column pairing (Senior row carries its matching
        // user_id via FK) and restores the cron behaviour so a missed
        // check-in escalates after the deadline instead of staying silent.
        const seniorsSql = `
            SELECT s.senior_id, s.preferred_checkin_time 
            FROM Senior s
            JOIN User_Account u ON s.user_id = u.user_id
            WHERE u.role_id = 1
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

        // Compare deadlines against Singapore wall-clock time so escalation
        // boundaries don't drift when the backend host runs outside UTC+8.
        const currentHour = getCurrentSgtHour();

        // 3. Process sequentially to prevent DB Queue Limit Reached errors
        for (const senior of seniors) {
            let timeStr = senior.preferred_checkin_time || '6:00 AM - 2:00 PM';
            
            // Parse the start time from the string
            let morningHour = 6;
            const match = timeStr.match(/(\d{1,2}):\d{2}\s*(AM|PM)/i);
            if (match) {
                morningHour = parseInt(match[1]);
                if (match[2].toUpperCase() === 'PM' && morningHour < 12) morningHour += 12;
                if (match[2].toUpperCase() === 'AM' && morningHour === 12) morningHour = 0;
            }

            // Calculate exact deadlines using an 8-hour check-in window.
            const eveningHour = (morningHour + 12) % 24;
            const morningDeadline = (morningHour + ESCALATION_WINDOW_HOURS) % 24;
            const eveningDeadline = (eveningHour + ESCALATION_WINDOW_HOURS) % 24;

            const hasMorning = seniorCheckins[senior.senior_id]?.morning;
            const hasEvening = seniorCheckins[senior.senior_id]?.evening;

            // Escalate Morning if past deadline and no check-in
            if (hasWindowElapsed(currentHour, morningHour, ESCALATION_WINDOW_HOURS) && !hasMorning) {
                console.log(`[ESCALATION] Senior ${senior.senior_id} missed Morning Check-in. Deadline was ${formatHourLabel(morningDeadline)}.`);
                await escalateCheckIn(senior.senior_id, 'Morning');
            }

            // Escalate Evening if past deadline and no check-in
            if (hasWindowElapsed(currentHour, eveningHour, ESCALATION_WINDOW_HOURS) && !hasEvening) {
                console.log(`[ESCALATION] Senior ${senior.senior_id} missed Evening Check-in. Deadline was ${formatHourLabel(eveningDeadline)}.`);
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
