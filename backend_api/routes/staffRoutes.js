const express = require("express");
const router = express.Router();
const db = require("../config/db");

const ASSIGNED_CASES_SQL = `
        SELECT
            shas.senior_id,
            ee.event_id,
            ee.event_type,
            ee.event_status,
            ee.escalation_level,
            ee.created_at,
            ee.created_at AS assigned_at
        FROM Senior_has_AIC_Staff shas
        LEFT JOIN Emergency_Event ee
            ON ee.event_id = (
                SELECT MAX(ev.event_id)
                FROM Emergency_Event ev
                WHERE ev.senior_id = shas.senior_id
            )
        WHERE shas.staff_id = ?
        ORDER BY COALESCE(ee.created_at, '1970-01-01') DESC, shas.senior_id ASC
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