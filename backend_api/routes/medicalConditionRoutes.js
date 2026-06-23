const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET all medical conditions
router.get("/", (req, res) => {

    const sql = `SELECT * FROM Medical_Condition`;

    db.query(sql, (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});


// GET senior medical conditions
router.get("/:senior_id", (req, res) => {

    const sql = `
        SELECT
          mc.condition_id,
          mc.condition_name,
          smc.severity_level,
          smc.medication_required,
          smc.diagnosed_date
        FROM Medical_Condition mc
        JOIN Senior_Medical_Condition smc
          ON mc.condition_id = smc.condition_id
        WHERE smc.senior_id = ?
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

module.exports = router;