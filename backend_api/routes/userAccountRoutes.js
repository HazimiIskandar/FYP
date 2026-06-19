const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require('bcryptjs');

// GET all users
router.get("/", (req, res) => {

    const sql = `SELECT * FROM User_Account`;

    db.query(sql, (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});


// LOGIN with password verification
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
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

        const user = result[0];
        const hash = user.password_hash || user.password || null;

        if (!hash) {
            // account exists but has no password set
            return res.status(403).json({ error: 'Password login not available for this account' });
        }

        bcrypt.compare(password, hash, (bcryptErr, matched) => {
            if (bcryptErr) return res.status(500).json({ error: bcryptErr.message || bcryptErr });
            if (!matched) return res.status(401).json({ error: 'Invalid credentials' });

            // remove password/hash before returning
            const safeUser = { ...user };
            delete safeUser.password_hash;
            delete safeUser.password;

            res.json(safeUser);
        });
    });
});

router.post("/register", (req, res) => {
    const { name, email, phone_number, role, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email and password are required" });
    }

    // prevent duplicate emails
    const checkSql = `SELECT user_id FROM User_Account WHERE email = ?`;
    db.query(checkSql, [email], (checkErr, checkRes) => {
        if (checkErr) return res.status(500).json({ error: checkErr.message || checkErr });
        if (checkRes.length) return res.status(409).json({ error: 'Email already registered' });

        // hash password
        bcrypt.hash(password, 10, (hashErr, hash) => {
            if (hashErr) return res.status(500).json({ error: hashErr.message || hashErr });

            // map role names to role_id if needed
            const roleMap = { 'Senior': 1, 'Caregiver': 2, 'AIC Staff': 3 };
            const roleId = roleMap[role] || null;

            // detect which password/role columns exist
            db.query("SHOW COLUMNS FROM User_Account", (colErr, colRes) => {
                if (colErr) return res.status(500).json({ error: colErr.message || colErr });

                const columns = colRes.map((column) => column.Field);
                const passwordColumn = columns.includes('password_hash')
                    ? 'password_hash'
                    : columns.includes('password')
                        ? 'password'
                        : null;

                if (!passwordColumn) {
                    return res.status(500).json({ error: 'User_Account table does not have password columns' });
                }

                const hasRoleId = columns.includes('role_id');
                const hasRole = columns.includes('role');

                const insertFields = ['full_name', 'email', 'phone_number', passwordColumn];
                const insertValues = [name, email, phone_number || '', hash];

                if (hasRoleId) {
                    insertFields.push('role_id');
                    insertValues.push(roleId);
                } else if (hasRole) {
                    insertFields.push('role');
                    insertValues.push(role || 'Senior');
                }

                const sql = `INSERT INTO User_Account (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;

                db.query(sql, insertValues, (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: err.message || err });
                    }
                    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
                });
            });
        });
    });
});

module.exports = router;