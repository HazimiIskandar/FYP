const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Assigned cases are derived from Escalation_Assignment, which links an AIC staff
// member (staff_id) to an Escalation_History row (escalation_id). Each escalation
// is tied to an Emergency_Event for a specific senior, so we join through those
// tables to surface the underlying case details. We group by event_id so a
// senior is not duplicated when multiple escalations exist for the same event.
const ASSIGNED_CASES_SQL = `
        SELECT
            ee.senior_id,
            ee.event_id,
            ee.event_status,
            ee.escalation_level,
            ee.created_at,
            MAX(eh.escalation_time) AS assigned_at
        FROM Escalation_Assignment ea
        JOIN Escalation_History eh
            ON ea.escalation_id = eh.escalation_id
        JOIN Emergency_Event ee
            ON eh.event_id = ee.event_id
        WHERE ea.staff_id = ?
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

        if (!Array.isArray(staffRows) || !staffRows.length) {
            // No AIC_Staff row linked to this user. We deliberately do NOT auto-create
            // one here, because doing so would produce a new auto-increment staff_id
            // that does not match any pre-existing Escalation_Assignment rows the
            // user may have seeded manually. Returning empty cases preserves the
            // integrity of the seeded assignment relationship.
            return res.json({ staff_id: null, cases: [] });
        }

        const staffId = staffRows[0].staff_id;
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