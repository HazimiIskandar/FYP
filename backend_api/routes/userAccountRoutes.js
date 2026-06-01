const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET all users
router.get("/", (req, res) => {

    const sql = `SELECT * FROM User_Account`;

    db.query(sql, (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});


// LOGIN (simpler version)
router.post("/login", (req, res) => {

    const { email } = req.body;

    const sql = `
        SELECT * FROM User_Account
        WHERE email = ?
    `;

    db.query(sql, [email], (err, result) => {
        if (err) return res.send(err);

        if (result.length === 0) {
            return res.send("User not found");
        }

        res.json(result[0]);
    });
});

module.exports = router;