const express = require("express");
const router = express.Router();
const { query } = require("../config/db");

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

  query(sql, (err, results) => {
    if (err) {
      console.error("❌ ERROR fetching seniors:", err.message);
      return res.status(500).json({ 
        error: "Failed to fetch seniors",
        details: err.message 
      });
    }
    console.log(`✅ Fetched ${results?.length || 0} seniors`);
    res.json(results || []);
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

  query(sql, [req.params.senior_id], (err, results) => {
    if (err) {
      console.error("❌ ERROR fetching senior:", err.message);
      return res.status(500).json({ 
        error: "Failed to fetch senior",
        details: err.message 
      });
    }
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

  query(sql, [req.params.senior_id], (err, results) => {
    if (err) {
      console.error("❌ ERROR fetching medical conditions:", err.message);
      return res.status(500).json({ 
        error: "Failed to fetch medical conditions",
        details: err.message 
      });
    }
    console.log(`✅ Fetched ${results?.length || 0} medical conditions for senior ${req.params.senior_id}`);
    res.json(results || []);
  });
});

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

  query(sql, [req.params.senior_id], (err, results) => {
    if (err) {
      console.error("❌ ERROR fetching NOK contacts:", err.message);
      return res.status(500).json({ 
        error: "Failed to fetch NOK contacts",
        details: err.message 
      });
    }
    console.log(`✅ Fetched ${results?.length || 0} NOK contacts for senior ${req.params.senior_id}`);
    res.json(results || []);
  });
});

module.exports = router;