const express = require("express");
const router = express.Router();
const db = require("../config/db");


// CREATE NOK 
router.post("/", (req, res) => {

    const { full_name, relationship_to_senior, phone_number, email } = req.body;

    const sql = `
        INSERT INTO NOK
        (full_name, relationship_to_senior, phone_number, email)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [full_name, relationship_to_senior, phone_number, email],
        (err) => {
            if (err) return res.send(err);

            res.send("NOK created successfully");
        }
    );
});


// GET ALL NOK 
router.get("/", (req, res) => {

    const sql = `
        SELECT * FROM NOK
    `;

    db.query(sql, (err, result) => {
        if (err) return res.send(err);

        res.json(result);
    });
});


// LINK NOK TO SENIOR 
router.post("/link", (req, res) => {

    const { senior_id, nok_id } = req.body;

    const sql = `
        INSERT INTO Senior_has_NOK
        (senior_id, nok_id)
        VALUES (?, ?)
    `;

    db.query(sql, [senior_id, nok_id], (err) => {
        if (err) return res.send(err);

        res.send("NOK linked to Senior successfully");
    });
});


// GET NOK BY SENIOR 
router.get("/senior/:senior_id", (req, res) => {

    const sql = `
        SELECT n.*
        FROM NOK n
        JOIN Senior_has_NOK sn
        ON n.nok_id = sn.nok_id
        WHERE sn.senior_id = ?
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);

        res.json(result);
    });
});

module.exports = router;