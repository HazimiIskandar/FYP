const express = require("express");
const router = express.Router();
const db = require("../config/db");

/**
 * GET ALL SENIORS (roster)
 */
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      s.senior_id,
      s.user_id,
      s.age,
      s.has_nok,
      s.created_at,
      u.full_name,
      u.phone_number,
      u.email,
      u.dob,
      u.gender,
      u.address,
      u.postal_code,
      u.unit_number
    FROM Senior s
    LEFT JOIN User_Account u ON s.user_id = u.user_id
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

/**
 * GET SINGLE SENIOR (basic profile)
 */
router.get("/:senior_id", (req, res) => {
  const sql = `
    SELECT 
      s.senior_id,
      s.user_id,
      s.age,
      s.has_nok,
      s.created_at,
      u.full_name,
      u.phone_number,
      u.email,
      u.dob,
      u.gender,
      u.address,
      u.postal_code,
      u.unit_number
    FROM Senior s
    LEFT JOIN User_Account u ON s.user_id = u.user_id
    WHERE s.senior_id = ?
  `;

  db.query(sql, [req.params.senior_id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results[0] || null);
  });
});

/**
 * GET MEDICAL CONDITIONS
 */
router.get("/:senior_id/medical-conditions", (req, res) => {
  const sql = `
    SELECT
      mc.condition_id,
      mc.condition_name,
      mc.severity_level,
      mc.medication_required,
      mc.notes,
      smc.diagnosed_date
    FROM Senior_Medical_Condition smc
    JOIN Medical_Condition mc
      ON smc.condition_id = mc.condition_id
    WHERE smc.senior_id = ?
  `;

  db.query(sql, [req.params.senior_id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

/**
 * GET NOK CONTACTS (FIXED STRUCTURE)
 * 🔥 IMPORTANT FIX: return relationship properly mapped
 */
router.get("/:senior_id/nok", (req, res) => {
  const sql = `
    SELECT 
      n.nok_id,
      n.relationship_to_senior,
      u.full_name,
      u.phone_number,
      u.email,
      u.address,
      u.postal_code
    FROM Senior_has_NOK sn
    JOIN NOK n ON sn.nok_id = n.nok_id
    JOIN User_Account u ON n.user_id = u.user_id
    WHERE sn.senior_id = ?
  `;

  db.query(sql, [req.params.senior_id], (err, results) => {
    if (err) return res.status(500).json(err);

    // 🔧 normalize response for frontend safety
    const formatted = results.map(r => ({
      nok_id: r.nok_id,
      full_name: r.full_name,
      relationship_to_senior: r.relationship_to_senior,
      phone_number: r.phone_number,
      email: r.email,
      address: r.address,
      postal_code: r.postal_code
    }));

    res.json(formatted);
  });
});

module.exports = router;