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

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    const sql = `
        SELECT * FROM User_Account
        WHERE email = ?
    `;

    db.query(sql, [email], (err, result) => {
        if (err) return res.status(500).json({ error: err.message || err });

        if (!result.length) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(result[0]);
    });
});

router.post("/register", (req, res) => {
    const { name, email, phone_number, role, biometric_enabled } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
    }

    const sql = `
        INSERT INTO User_Account
        (full_name, email, phone_number, role, biometric_enabled)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [name, email, phone_number || '', role || 'user', biometric_enabled || 0],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message || err });
            }
            res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
        }
    );
});

module.exports = router;