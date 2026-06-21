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
      YEAR(CURDATE()) - YEAR(u.dob) - (DATE_FORMAT(u.dob, '%m%d') > DATE_FORMAT(CURDATE(), '%m%d')) AS age,
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
      YEAR(CURDATE()) - YEAR(u.dob) - (DATE_FORMAT(u.dob, '%m%d') > DATE_FORMAT(CURDATE(), '%m%d')) AS age,
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

router.post("/:senior_id/link-code", (req, res) => {
  const { link_code } = req.body;
  const { senior_id } = req.params;

  if (!link_code || !/^\d{6}$/.test(link_code)) {
    return res.status(400).json({ error: "A valid 6-digit link code is required." });
  }

  const sql = `
    INSERT INTO Senior_Link_Code (senior_id, link_code)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE link_code = VALUES(link_code)
  `;

  db.query(sql, [senior_id, link_code], (err) => {
    if (err) return res.status(500).json({ error: err.message || err });
    res.json({ message: "Senior link code saved successfully." });
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
/**
 * GET NOK CONTACTS
 */
router.get("/:senior_id/nok", (req, res) => {
  const sql = `
    SELECT
      n.nok_id,
      n.full_name,
      n.phone_number,
      n.email,
      n.relationship_to_senior
    FROM Senior_has_NOK sn
    JOIN NOK n
      ON sn.nok_id = n.nok_id
    WHERE sn.senior_id = ?
  `;

  db.query(sql, [req.params.senior_id], (err, results) => {
    if (err) return res.status(500).json(err);

    res.json(results);
  });
});

module.exports = router;