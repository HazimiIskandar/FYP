const express = require("express");
const router = express.Router();
const db = require("../config/db");


// GET ALL SENIORS 
router.get("/", (req, res) => {

    const sql = `
        SELECT * FROM Senior
    `;

    db.query(sql, (err, result) => {
        if (err) return res.send(err);

        res.json(result);
    });
});


// GET ONE SENIOR 
router.get("/:senior_id", (req, res) => {

    const sql = `
        SELECT * FROM Senior
        WHERE senior_id = ?
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);

        res.json(result[0]);
    });
});


// CREATE SENIOR 
router.post("/", (req, res) => {

    const { full_name, age, gender, address, phone_number } = req.body;

    const sql = `
        INSERT INTO Senior
        (full_name, age, gender, address, phone_number)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [full_name, age, gender, address, phone_number],
        (err) => {
            if (err) return res.send(err);

            res.send("Senior created successfully");
        }
    );
});


// GET SENIOR + REWARD INFO 
router.get("/:senior_id/details", (req, res) => {

    const sql = `
        SELECT 
            s.*,
            r.current_streak,
            r.total_points
        FROM Senior s
        LEFT JOIN Reward_Streak r
        ON s.senior_id = r.senior_id
        WHERE s.senior_id = ?
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);

        res.json(result[0]);
    });
});

module.exports = router;