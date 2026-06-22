const express = require("express");
const router = express.Router();
const db = require("../config/db");

/**
 * CREATE SENIOR RECORD IF MISSING
 */
router.post("/", (req, res) => {
  const { user_id } = req.body || {};

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required." });
  }

  const findSql = `SELECT senior_id FROM Senior WHERE user_id = ? LIMIT 1`;

  db.query(findSql, [user_id], (findErr, findRows) => {
    if (findErr) return res.status(500).json({ error: findErr.message || findErr });

    if (Array.isArray(findRows) && findRows.length > 0) {
      return res.json({ senior_id: findRows[0].senior_id, message: "Senior record already exists." });
    }

    const insertSeniorSql = `INSERT INTO Senior (user_id, preferred_checkin_time) VALUES (?, '9:00 AM')`;

    db.query(insertSeniorSql, [user_id], (insertErr, insertResult) => {
      if (insertErr) return res.status(500).json({ error: insertErr.message || insertErr });

      const seniorId = insertResult.insertId;

      // Auto-create Reward_Streak so Daily_CheckIn FK is always satisfiable
      const insertRewardSql = `
        INSERT INTO Reward_Streak (senior_id, current_streak, total_points) VALUES (?, 0, 0)
      `;

      db.query(insertRewardSql, [seniorId], (rewardErr) => {
        if (rewardErr) {
          console.log("Warning: could not create Reward_Streak:", rewardErr.message);
        }

        res.status(201).json({
          senior_id: seniorId,
          message: "Senior record created successfully.",
        });
      });
    });
  });
});

/**
 * GET ALL SENIORS (roster)
 */
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      s.senior_id,
      s.user_id,
      s.preferred_checkin_time,
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
    JOIN User_Account u ON s.user_id = u.user_id
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
      s.preferred_checkin_time,
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
    JOIN User_Account u ON s.user_id = u.user_id
    WHERE s.senior_id = ?
  `;

  db.query(sql, [req.params.senior_id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results[0] || null);
  });
});

/**
 * PUT UPDATE PREFERRED CHECK-IN TIME
 */
router.put("/:senior_id/checkin-time", (req, res) => {
  const { preferred_checkin_time } = req.body;
  const { senior_id } = req.params;

  if (!preferred_checkin_time) {
    return res.status(400).json({ error: 'preferred_checkin_time is required.' });
  }

  const sql = `UPDATE Senior SET preferred_checkin_time = ? WHERE senior_id = ?`;

  db.query(sql, [preferred_checkin_time, senior_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message || err });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Senior not found.' });
    }
    res.json({ message: 'Check-in time saved.', preferred_checkin_time });
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

router.put("/:senior_id/nok", (req, res) => {
  const seniorId = req.params.senior_id;

  const {
    full_name,
    phone_number,
    email,
    relationship_to_senior,
  } = req.body;

  const checkSql = `
    SELECT nok_id
    FROM Senior_has_NOK
    WHERE senior_id = ?
  `;

  db.query(checkSql, [seniorId], (err, results) => {
    if (err) return res.status(500).json(err);

    // Senior already has NOK
    if (results.length > 0) {
      const nokId = results[0].nok_id;

      const updateSql = `
        UPDATE NOK
        SET
          full_name = ?,
          phone_number = ?,
          email = ?,
          relationship_to_senior = ?
        WHERE nok_id = ?
      `;

      db.query(
        updateSql,
        [
          full_name,
          phone_number,
          email,
          relationship_to_senior,
          nokId,
        ],
        (err) => {
          if (err) return res.status(500).json(err);

          res.json({
            nok_id: nokId,
            message: "Emergency contact updated.",
          });
        }
      );
    }
    // Senior doesn't have NOK
    else {
      const insertSql = `
        INSERT INTO NOK
        (full_name, phone_number, email, relationship_to_senior)
        VALUES (?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [
          full_name,
          phone_number,
          email,
          relationship_to_senior,
        ],
        (err, result) => {
          if (err) return res.status(500).json(err);

          const nokId = result.insertId;

          const linkSql = `
            INSERT INTO Senior_has_NOK
            (senior_id, nok_id)
            VALUES (?, ?)
          `;

          db.query(
            linkSql,
            [seniorId, nokId],
            (err) => {
              if (err)
                return res.status(500).json(err);

              res.json({
                nok_id: nokId,
                message:
                  "Emergency contact created and linked.",
              });
            }
          );
        }
      );
    }
  });
});

router.put('/:senior_id/medical-condition', (req, res) => {
  const seniorId = req.params.senior_id;
  const {
    condition_id,
    customCondition,
    diagnosed_date,
    severity_level,
    medication_required,
  } = req.body;

  if (!seniorId) {
    return res.status(400).json({ error: 'Senior ID is required.' });
  }

  const upsertCondition = (resolvedConditionId) => {
    if (!resolvedConditionId) {
      return res.status(400).json({ error: 'A valid condition_id or customCondition is required.' });
    }

    const sql = `
      INSERT INTO Senior_Medical_Condition (senior_id, condition_id, diagnosed_date)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        condition_id = VALUES(condition_id),
        diagnosed_date = VALUES(diagnosed_date)
    `;

    db.query(sql, [seniorId, resolvedConditionId, diagnosed_date || null], (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: 'Senior medical condition saved successfully.' });
    });
  };

  if (customCondition && !condition_id) {
    const insertConditionSql = `
      INSERT INTO Medical_Condition (condition_name, severity_level, medication_required)
      VALUES (?, ?, ?)
    `;

    db.query(
      insertConditionSql,
      [customCondition, severity_level || null, medication_required || null],
      (err, result) => {
        if (err) return res.status(500).json(err);
        upsertCondition(result.insertId);
      }
    );
  } else {
    upsertCondition(condition_id);
  }
});

/**
 * CREATE NOK and link to senior
 */
router.post('/:senior_id/nok', (req, res) => {
  const seniorId = req.params.senior_id;
  const { full_name, phone_number, email, relationship_to_senior } = req.body;

  const insertSql = `
    INSERT INTO NOK (full_name, phone_number, email, relationship_to_senior)
    VALUES (?, ?, ?, ?)
  `;

  db.query(insertSql, [full_name, phone_number, email, relationship_to_senior], (err, result) => {
    if (err) return res.status(500).json(err);

    const nokId = result.insertId;

    const linkSql = `
      INSERT INTO Senior_has_NOK (senior_id, nok_id)
      VALUES (?, ?)
    `;

    db.query(linkSql, [seniorId, nokId], (err) => {
      if (err) return res.status(500).json(err);

      res.json({ nok_id: nokId, message: 'Emergency contact created and linked.' });
    });
  });
});

module.exports = router;