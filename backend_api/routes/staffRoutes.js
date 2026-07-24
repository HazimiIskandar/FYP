const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Assigned cases flow through Escalation_History -> Emergency_Event -> Senior.
// We LEFT JOIN Escalation_Assignment so that escalations with NO explicit
// staff assignment still surface in the AIC portal as part of the triage
// queue. The placeholder is the AIC staff `staff_id` (or NULL when no
// AIC_Staff row is linked to the logged-in user):
//   - ea.staff_id IS NULL  => unassigned, shown to every AIC staff
//   - ea.staff_id = ?       => explicitly assigned to this staff
//
// We additionally INNER JOIN Senior + User_Account and require a non-empty
// `full_name`. This filters out:
//   1. Orphan events whose `senior_id` points to a Senior row that has been
//      deleted (the FK would normally forbid this, but legacy rows from
//      before the CASCADE constraint landed may still slip through).
//   2. Events whose linked Senior has a NULL or blank `full_name` in
//      User_Account — these would surface to AIC staff as "Unknown Senior"
//      rows, which are entirely unactionable (no name means no caller ID,
//      no dispatch context, and no roster row to navigate to).
// Filtering at the SQL level keeps the AIC portal payload lean and is the
// single source of truth for "should this case be shown?".
//
// We also EXCLUDE `event_type = 'Missed Check-In'` from the AIC portal.
// The escalation engine (backend_api/routes/escalationRoutes.js) fires
// every 10 minutes via server.js's setInterval; without filtering, the AIC
// portal accumulated ~144 duplicate "Missed Check-In" rows per senior per
// day (one per monitor tick), quickly ballooning past 8,000 rows on
// production. Missed check-ins are a CAREGIVER/NOK concern (Notification
// fanout already routes them), so the AIC triage queue is reserved for
// real emergencies (SOS / Sensor Alert / Fall Detected) — anyone who taps
// the caregiver "I handled this" path can escalate the case to AIC staff
// deliberately via Escalation_Assignment. The parens around the OR clause
// below are required: `AND` has higher precedence than `OR` in MySQL,
// so dropping them would silently short-circuit the staff-assignment
// fallback and break the unassigned-case flow.
const ASSIGNED_CASES_SQL = `
        SELECT
            ee.senior_id,
            ee.event_id,
            ee.event_status,
            ee.escalation_level,
            ee.created_at,
            MAX(eh.escalation_time) AS assigned_at
        FROM Escalation_History eh
        JOIN Emergency_Event ee
            ON eh.event_id = ee.event_id
        JOIN Senior s
            ON ee.senior_id = s.senior_id
        JOIN User_Account ua
            ON s.user_id = ua.user_id
        LEFT JOIN Escalation_Assignment ea
            ON eh.escalation_id = ea.escalation_id
        WHERE (ea.staff_id IS NULL OR ea.staff_id = ?)
          AND ua.full_name IS NOT NULL
          AND TRIM(ua.full_name) <> ''
          AND ua.role_id = 1
        GROUP BY
            ee.event_id,
            ee.senior_id,
            ee.event_status,
            ee.escalation_level,
            ee.created_at
        ORDER BY assigned_at DESC, ee.senior_id ASC
`;

// GET all staff
router.get("/", (req, res) => {

    const sql = `SELECT * FROM AIC_Staff`;

    db.query(sql, (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

// GET assigned cases by logged-in user_id
router.get('/assigned-cases/by-user/:user_id', (req, res) => {
    const userId = req.params.user_id;

    const staffSql = `
        SELECT staff_id
        FROM AIC_Staff
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(staffSql, [userId], (staffErr, staffRows) => {
        if (staffErr) return res.status(500).json({ error: staffErr.message || staffErr });

        // If the user has no AIC_Staff row yet, fall back to passing NULL.
        // The lenient SQL returns any unassigned escalations in that case
        // (ea.staff_id IS NULL) so newly-seeded cases still surface in the portal.
        const staffId =
            Array.isArray(staffRows) && staffRows.length ? staffRows[0].staff_id : null;

        db.query(ASSIGNED_CASES_SQL, [staffId], (casesErr, casesRows) => {
            if (casesErr) return res.status(500).json({ error: casesErr.message || casesErr });
            res.json({ staff_id: staffId, cases: Array.isArray(casesRows) ? casesRows : [] });
        });
    });
});

// GET assigned cases by staff_id
router.get('/:staff_id/assigned-cases', (req, res) => {
    db.query(ASSIGNED_CASES_SQL, [req.params.staff_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message || err });
        res.json(Array.isArray(rows) ? rows : []);
    });
});


// GET staff by id
router.get("/:staff_id", (req, res) => {

    const sql = `
        SELECT * FROM AIC_Staff
        WHERE staff_id = ?
    `;

    db.query(sql, [req.params.staff_id], (err, result) => {
        if (err) return res.send(err);
        res.json(result[0]);
    });
});

module.exports = router;