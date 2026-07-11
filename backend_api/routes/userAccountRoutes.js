const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require('bcryptjs');

// Languages the mobile app currently ships translations for. Kept in sync with
// /locales/{en,zh,ms,ta}.json + screens/LanguageScreen.js. Validated server-side
// so a malformed PUT can't poison the User_Account.preferred_language column.
const SUPPORTED_LANGUAGES = ['en', 'zh', 'ms', 'ta'];

const isSupportedLanguage = (code) =>
    SUPPORTED_LANGUAGES.includes(String(code || '').toLowerCase().trim());

// Migration: add User_Account.preferred_language if it does not yet exist.
// Runs synchronously at module load using the callback-style db.query so
// the column is guaranteed to exist by the time the first HTTP request
// reaches the route handlers. ER_DUP_FIELDNAME is swallowed because it
// just means another instance won the race.
db.query("SHOW COLUMNS FROM User_Account LIKE 'preferred_language'", (showErr, showRows) => {
    if (showErr) {
        console.error(
            '[userAccountRoutes] Failed to check preferred_language column:',
            showErr.message || showErr
        );
        return;
    }

    if (Array.isArray(showRows) && showRows.length > 0) {
        return;
    }

    db.query(
        "ALTER TABLE User_Account ADD COLUMN preferred_language VARCHAR(8) NULL DEFAULT NULL",
        (alterErr) => {
            if (alterErr) {
                if (alterErr.code === 'ER_DUP_FIELDNAME') return;
                console.error(
                    '[userAccountRoutes] Failed to add preferred_language column:',
                    alterErr.message || alterErr
                );
                return;
            }
            console.log('[userAccountRoutes] Added preferred_language column to User_Account');
        }
    );
});

const capitalizeWords = (value) =>
    String(value || '')
        .replace(/\d/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

const isValidName = (value) => {
    const text = String(value || '').trim();
    return Boolean(text) && !/\d/.test(text);
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.com$/i.test(String(value || '').trim());
const isEightDigitPhone = (value) => /^\d{8}$/.test(String(value || '').trim());

const isStrongPassword = (value) => {
    const password = String(value || '');
    const hasStrongMix =
        password.length >= 12 &&
        password.length <= 64 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /\d/.test(password) &&
        /[^A-Za-z0-9]/.test(password);
    const hasPassphrase =
        password.length >= 16 &&
        password.length <= 64 &&
        password.trim().split(/\s+/).filter(Boolean).length >= 3;

    return hasStrongMix || hasPassphrase;
};

const getAgeFromDBDate = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const hasBirthdayPassed =
        today.getMonth() > date.getMonth() ||
        (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());

    if (!hasBirthdayPassed) age -= 1;
    return age;
};

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
    const { name, email, phone_number, role, password, preferred_language } = req.body;
    const normalizedName = capitalizeWords(name);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPreferredLanguage = preferred_language === undefined || preferred_language === null || preferred_language === ''
        ? null
        : String(preferred_language).toLowerCase().trim();

    // Required-field checks first so a missing name/email/password returns
    // the actionable error before the locale validation.
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (!isValidName(name)) {
        return res.status(400).json({ error: "Full name cannot contain numbers." });
    }
    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: "Email must include @ and end with .com." });
    }
    if (!isStrongPassword(password)) {
        return res.status(400).json({ error: "Password must be 12+ characters with uppercase, lowercase, number, and symbol, or a 16+ character multi-word passphrase." });
    }
    if (normalizedPreferredLanguage !== null && !isSupportedLanguage(normalizedPreferredLanguage)) {
        return res.status(400).json({
            error: `preferred_language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}.`,
        });
    }

    // prevent duplicate emails
    const checkSql = `SELECT user_id FROM User_Account WHERE email = ?`;
    db.query(checkSql, [normalizedEmail], (checkErr, checkRes) => {
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
                const insertValues = [normalizedName, normalizedEmail, phone_number || '', hash];

                if (hasRoleId) {
                    insertFields.push('role_id');
                    insertValues.push(roleId);
                } else if (hasRole) {
                    insertFields.push('role');
                    insertValues.push(role || 'Senior');
                }

                // Only persist preferred_language when the client provided
                // an explicit value. NULL means "user hasn't picked one yet"
                // so future logins can fall back to the app default.
                if (normalizedPreferredLanguage !== null && columns.includes('preferred_language')) {
                    insertFields.push('preferred_language');
                    insertValues.push(normalizedPreferredLanguage);
                }

                const sql = `INSERT INTO User_Account (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;

                db.query(sql, insertValues, (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: err.message || err });
                    }

                    const createdUserId = result.insertId;
                    const isAicStaff = roleId === 3 || `${role || ''}`.toLowerCase() === 'aic staff';

                    if (!isAicStaff) {
                        return res.status(201).json({ message: 'User registered successfully', userId: createdUserId });
                    }

                    const createStaffSql = `INSERT INTO AIC_Staff (user_id) VALUES (?)`;
                    db.query(createStaffSql, [createdUserId], (staffErr) => {
                        if (staffErr) {
                            return res.status(500).json({ error: staffErr.message || staffErr });
                        }

                        res.status(201).json({ message: 'User registered successfully', userId: createdUserId });
                    });
                });
            });
        });
    });
});

// PUT /users/:user_id/language — used by the mobile app to save the
// preferred UI locale when a logged-in user picks a new language from
// either LanguageScreen or the SeniorHomeScreen language modal.
router.put('/:user_id/language', (req, res) => {
    const userId = req.params.user_id;
    const requested = String(req.body?.preferred_language || '').toLowerCase().trim();

    if (!isSupportedLanguage(requested)) {
        return res.status(400).json({
            error: `preferred_language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}.`,
        });
    }

    const sql = `UPDATE User_Account SET preferred_language = ? WHERE user_id = ?`;

    db.query(sql, [requested, userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message || err });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({
            message: 'Language preference saved.',
            preferred_language: requested,
        });
    });
});

router.put('/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const {
        full_name,
        phone_number,
        dob,
        gender,
        address,
        postal_code,
        unit_number,
    } = req.body;

    const fields = [];
    const params = [];

    if (full_name !== undefined) {
        if (!isValidName(full_name)) {
            return res.status(400).json({ error: 'Full name cannot contain numbers.' });
        }
        fields.push('full_name = ?');
        params.push(capitalizeWords(full_name));
    }
    if (phone_number !== undefined) {
        if (!isEightDigitPhone(phone_number)) {
            return res.status(400).json({ error: 'Phone number must be exactly 8 digits.' });
        }
        fields.push('phone_number = ?');
        params.push(String(phone_number || '').trim());
    }
    if (dob !== undefined) {
        const age = getAgeFromDBDate(dob);
        if (age === null || age < 60) {
            return res.status(400).json({ error: 'Senior must be at least 60 years old.' });
        }
        fields.push('dob = ?');
        params.push(dob);
    }
    if (gender !== undefined) {
        fields.push('gender = ?');
        params.push(gender);
    }
    if (address !== undefined) {
        fields.push('address = ?');
        params.push(address);
    }
    if (postal_code !== undefined) {
        fields.push('postal_code = ?');
        params.push(postal_code);
    }
    if (unit_number !== undefined) {
        fields.push('unit_number = ?');
        params.push(unit_number);
    }

    if (!fields.length) {
        return res.status(400).json({ error: 'No user fields to update.' });
    }

    const sql = `UPDATE User_Account SET ${fields.join(', ')} WHERE user_id = ?`;
    params.push(userId);

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ error: err.message || err });
        res.json({ message: 'User updated successfully' });
    });
});

module.exports = router;
