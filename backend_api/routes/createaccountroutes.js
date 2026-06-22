const express = require("express");
const router = express.Router();
const db = require("../config/db");

/**
 * CREATE ACCOUNT
 */
router.post("/", (req, res) => {
  const { full_name, name, email, password, role, role_id } = req.body;
  const resolvedName = full_name || name;
  const normalizedRole = `${role || ''}`.trim().toLowerCase();
  const resolvedRoleId = Number(role_id) || (normalizedRole === 'aic staff' ? 3 : null);
  const isAicStaff = resolvedRoleId === 3 || normalizedRole === 'aic staff';

  // Validate input
  if (!resolvedName || !email || !password) {
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

    db.query("SHOW COLUMNS FROM User_Account", (columnsErr, columnsResult) => {
      if (columnsErr) return res.status(500).json(columnsErr);

      const columns = Array.isArray(columnsResult)
        ? columnsResult.map((column) => column.Field)
        : [];

      const insertFields = ['full_name', 'email', 'password'];
      const insertValues = [resolvedName, email, password];

      if (columns.includes('role_id') && resolvedRoleId) {
        insertFields.push('role_id');
        insertValues.push(resolvedRoleId);
      } else if (columns.includes('role') && role) {
        insertFields.push('role');
        insertValues.push(role);
      }

      const insertSql = `
        INSERT INTO User_Account (${insertFields.join(', ')})
        VALUES (${insertFields.map(() => '?').join(', ')})
      `;

      db.query(insertSql, insertValues, (err, result) => {
        if (err) return res.status(500).json(err);

        const createdUserId = result.insertId;

        if (!isAicStaff) {
          return res.status(201).json({
            message: "Account created successfully",
            user_id: createdUserId
          });
        }

        const createStaffSql = `INSERT INTO AIC_Staff (user_id) VALUES (?)`;
        db.query(createStaffSql, [createdUserId], (staffErr) => {
          if (staffErr) {
            return res.status(500).json(staffErr);
          }

          res.status(201).json({
            message: "Account created successfully",
            user_id: createdUserId
          });
        });
      });
    });
  });
});

module.exports = router;