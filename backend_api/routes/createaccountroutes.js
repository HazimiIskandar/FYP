const express = require("express");
const router = express.Router();
const db = require("../config/db");

/**
 * CREATE ACCOUNT
 */
router.post("/", (req, res) => {
  const { full_name, email, password } = req.body;

  // Validate input
  if (!full_name || !email || !password) {
    return res.status(400).json({
      message: "All fields are required."
    });
  }

  // Check if email exists
  const checkSql = `
    SELECT * FROM User_Account WHERE email = ?
  `;

  db.query(checkSql, [email], (err, results) => {
    if (err) return res.status(500).json(err);

    if (results.length > 0) {
      return res.status(400).json({
        message: "Email already exists."
      });
    }

    // Insert new user
    const insertSql = `
      INSERT INTO User_Account (full_name, email, password)
      VALUES (?, ?, ?)
    `;

    db.query(insertSql, [full_name, email, password], (err, result) => {
      if (err) return res.status(500).json(err);

      res.status(201).json({
        message: "Account created successfully",
        user_id: result.insertId
      });
    });
  });
});

module.exports = router;