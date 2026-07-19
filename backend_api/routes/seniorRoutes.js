const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

const ensureSeniorMedicalConditionColumns = async () => {
  try {
    const columns = await runQuery("SHOW COLUMNS FROM Senior_Medical_Condition");
    const columnNames = new Set(columns.map((column) => column.Field));
    const alterations = [];

    if (!columnNames.has("severity_level")) {
      alterations.push("ADD COLUMN severity_level VARCHAR(45) NULL");
    }
    if (!columnNames.has("medication_required")) {
      alterations.push("ADD COLUMN medication_required VARCHAR(45) NULL");
    }

    for (const alteration of alterations) {
      await runQuery(`ALTER TABLE Senior_Medical_Condition ${alteration}`);
    }

    await runQuery("ALTER TABLE Senior_Medical_Condition MODIFY diagnosed_date DATE NULL");
  } catch (err) {
    console.error("Failed to prepare Senior_Medical_Condition columns:", err.message || err);
  }
};

const seniorMedicalConditionColumnsReady = ensureSeniorMedicalConditionColumns();

const capitalizeWords = (value) =>
  String(value || "")
    .replace(/\d/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const isValidName = (value) => {
  const text = String(value || "").trim();
  return Boolean(text) && !/\d/.test(text);
};

const isEightDigitPhone = (value) => /^\d{8}$/.test(String(value || "").trim());
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.com$/i.test(String(value || "").trim());

const validateNokPayload = ({ full_name, phone_number, email }) => {
  if (full_name !== undefined && !isValidName(full_name)) {
    return "Emergency contact name cannot contain numbers.";
  }
  if (phone_number !== undefined && !isEightDigitPhone(phone_number)) {
    return "Emergency contact phone number must be exactly 8 digits.";
  }
  if (email && !isValidEmail(email)) {
    return "Emergency contact email must include @ and end with .com.";
  }
  return null;
};

const createLinkCode = () => {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += String(crypto.randomInt(0, 10));
  }
  return code;
};

const saveUniqueLinkCode = (seniorId, attempts, callback, requestedCode = null) => {
  if (attempts <= 0) {
    callback(new Error("Unable to generate a unique link code. Please try again."));
    return;
  }

  const linkCode = requestedCode || createLinkCode();

  db.query(
    "SELECT senior_id FROM Senior_Link_Code WHERE link_code = ? LIMIT 1",
    [linkCode],
    (checkErr, rows) => {
      if (checkErr) {
        callback(checkErr);
        return;
      }

      if (rows.length && String(rows[0].senior_id) !== String(seniorId)) {
        if (requestedCode) {
          callback(new Error("This link code is already in use. Please generate another code."));
          return;
        }

        saveUniqueLinkCode(seniorId, attempts - 1, callback);
        return;
      }

      const sql = `
        INSERT INTO Senior_Link_Code (senior_id, link_code, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          link_code = VALUES(link_code),
          created_at = CURRENT_TIMESTAMP
      `;

      db.query(sql, [seniorId, linkCode], (err) => {
        if (err && err.code === "ER_DUP_ENTRY") {
          if (requestedCode) {
            callback(new Error("This link code is already in use. Please generate another code."));
            return;
          }

          saveUniqueLinkCode(seniorId, attempts - 1, callback);
          return;
        }

        callback(err, linkCode);
      });
    }
  );
};

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

    const insertSeniorSql = `INSERT INTO Senior (user_id, preferred_checkin_time) VALUES (?, '9:00 AM - 10:00 AM, 5:00 PM - 6:00 PM')`;

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

router.post("/link-caregiver", (req, res) => {
  const linkCode = String(req.body?.link_code || "").trim();
  const caregiverId = req.body?.caregiver_id;

  // Defense-in-depth copy of the per-caregiver senior cap that lives in
  // /caregiver/link-senior (the canonical reach inside the React Native
  // app's `CaregiverSeniorsListScreen.js`). The senior-side route
  // /seniors/link-caregiver isn't currently called from any front-end
  // flow (verified by grepping screens/* for `link-caregiver`), but if
  // a future admin tool, integration test, or external client invokes
  // it we still want the same MAX_SENIORS_PER_CAREGIVER guard rather
  // than silently letting the caregiver's roster grow without bound.
  // The cap constant is duplicated here deliberately — importing from
  // caregiverRoutes into seniorRoutes would create a sibling-route
  // cross-dependency that complicates unit testing both files in
  // isolation. Bumping the cap requires updating both files; the
  // multi-line comment block in caregiverRoutes.js documents the
  // reason for the duplication.
  const MAX_SENIORS_PER_CAREGIVER = 5;

  if (!/^\d{6}$/.test(linkCode)) {
    return res.status(400).json({ error: "A valid 6-digit link code is required." });
  }

  if (!caregiverId || Number.isNaN(Number(caregiverId))) {
    return res.status(400).json({ error: "Caregiver user ID is required." });
  }

  const findSeniorSql = `
    SELECT senior_id
    FROM Senior_Link_Code
    WHERE link_code = ?
    LIMIT 1
  `;

  db.query(findSeniorSql, [linkCode], (findErr, seniorRows) => {
    if (findErr) return res.status(500).json({ error: findErr.message || findErr });
    if (!seniorRows.length) {
      return res.status(404).json({ error: "No senior found for that link code." });
    }

    const seniorId = seniorRows[0].senior_id;
    const verifyCaregiverSql = `
      SELECT role_id
      FROM User_Account
      WHERE user_id = ?
      LIMIT 1
    `;

    db.query(verifyCaregiverSql, [caregiverId], (caregiverErr, caregiverRows) => {
      if (caregiverErr) return res.status(500).json({ error: caregiverErr.message || caregiverErr });
      if (!caregiverRows.length || Number(caregiverRows[0].role_id) !== 2) {
        return res.status(403).json({ error: "Only caregiver accounts can link to a senior." });
      }

      // Capacity gate — identical contract to /caregiver/link-senior so
      // any client receives the same error shape, error code, and the
      // structured current_count / max_count fields.
      const countSql = `
        SELECT COUNT(*) AS total
        FROM Senior_has_Caregiver
        WHERE caregiver_id = ?
      `;

      db.query(countSql, [caregiverId], (countErr, countRows) => {
        if (countErr) return res.status(500).json({ error: countErr.message || countErr });

        const currentCount = Number(countRows?.[0]?.total) || 0;
        if (currentCount >= MAX_SENIORS_PER_CAREGIVER) {
          return res.status(409).json({
            error: `You have reached the maximum of ${MAX_SENIORS_PER_CAREGIVER} seniors per caregiver. Please remove a senior before adding a new one.`,
            code: 'CAREGIVER_AT_SENIOR_LIMIT',
            current_count: currentCount,
            max_count: MAX_SENIORS_PER_CAREGIVER,
          });
        }

        // Self-healing duplicate probe. Mirrors /caregiver/link-senior so
        // the senior-side route behaves the same way: a stale Senior_has_Caregiver
        // row whose Senior row is missing (e.g. a previous removal flow
        // deleted the Senior record without the linkage CASCADE catching
        // up) is treated as a dangling reference and auto-cleaned, so that
        // re-linking the same SeniorId + CaregiverId just Works rather
        // than confusing the user with a false-positive "already linked"
        // 409. The probe's LEFT JOIN against Senior distinguishes:
        //   * senior_row_present IS NOT NULL — both rows exist; this is a
        //     genuine duplicate and we 409.
        //   * senior_row_present IS NULL — the linker row is orphaned;
        //     we DELETE it and fall through to the fresh INSERT.
        // * No linker row at all — proceed straight to INSERT.
        const probeSql = `
          SELECT
            shc.senior_id,
            shc.caregiver_id,
            s.senior_id AS senior_row_present
          FROM Senior_has_Caregiver shc
          LEFT JOIN Senior s
            ON s.senior_id = shc.senior_id
          WHERE shc.senior_id = ? AND shc.caregiver_id = ?
          LIMIT 1
        `;

        // Shared insertion helper so the dangling-cleanup branch and the
        // no-existing-linkage branch both surface the same 201 response
        // shape (including the current_count / max_count tags that the RN
        // banner relies on).
        const insertLinkage = () => {
          const insertSql = `
            INSERT INTO Senior_has_Caregiver (senior_id, caregiver_id)
            VALUES (?, ?)
          `;

          db.query(insertSql, [seniorId, caregiverId], (insertErr) => {
            if (insertErr) return res.status(500).json({ error: insertErr.message || insertErr });
            res.status(201).json({
              message: "Senior linked to caregiver successfully.",
              senior_id: seniorId,
              caregiver_id: Number(caregiverId),
              current_count: currentCount + 1,
              max_count: MAX_SENIORS_PER_CAREGIVER,
            });
          });
        };

        db.query(probeSql, [seniorId, caregiverId], (probeErr, probeRows) => {
          if (probeErr) return res.status(500).json({ error: probeErr.message || probeErr });

          if (probeRows.length) {
            if (probeRows[0].senior_row_present) {
              return res.status(409).json({
                error: "This senior is already linked to your caregiver account.",
              });
            }
            // Dangling linkage — same self-heal path as /caregiver/link-senior.
            db.query(
              'DELETE FROM Senior_has_Caregiver WHERE senior_id = ? AND caregiver_id = ?',
              [seniorId, caregiverId],
              (cleanupErr) => {
                if (cleanupErr) {
                  return res.status(500).json({ error: cleanupErr.message || cleanupErr });
                }
                insertLinkage();
              }
            );
            return;
          }

          // No existing linkage at all — clean insert.
          insertLinkage();
        });
      });
    });
  });
});

// GET /seniors/:senior_id/linkage-summary
// Returns caregiver + NOK link counts and a derived `is_fully_linked`
// flag so the React Native app can decide whether to lock features
// (I'm-Okay, Community games, Emergency) for newly-created accounts
// whose caregiver has not yet been linked. Counts come from the
// authoritative Senior_has_Caregiver + Senior_has_NOK junction tables;
// one round-trip via subqueries keeps latency tiny. Defined BEFORE the
// generic /:senior_id route below so Express doesn't route the
// literal string "linkage-summary" into the wrong handler.
router.get("/:senior_id/linkage-summary", (req, res) => {
  const seniorId = req.params.senior_id;
  if (!seniorId || Number.isNaN(Number(seniorId))) {
    return res.status(400).json({ error: "A valid senior_id is required." });
  }

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM Senior_has_Caregiver WHERE senior_id = ?) AS caregivers,
      (SELECT COUNT(*) FROM Senior_has_NOK         WHERE senior_id = ?) AS noks
  `;
  db.query(sql, [seniorId, seniorId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message || err });
    const row = (Array.isArray(rows) && rows[0]) || {};
    const caregiverCount = Number(row.caregivers) || 0;
    const nokCount = Number(row.noks) || 0;
    // RN gate is `is_fully_linked = caregiverCount > 0` because the
    // senior's primary setup step is the caregiver linking their account
    // via /caregiver/link-senior (the RN app prompts the senior to hand
    // a matching 6-digit code to the caregiver to drive that flow).
    // `caregiver_count` and `nok_count` are also returned so future
    // versions of the front-end can introduce more granular states.
    return res.json({
      senior_id: Number(seniorId),
      caregiver_count: caregiverCount,
      nok_count: nokCount,
      is_fully_linked: caregiverCount > 0,
    });
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
  const { senior_id } = req.params;
  const requestedCode = req.body?.link_code ? String(req.body.link_code).trim() : null;

  if (!senior_id || Number.isNaN(Number(senior_id))) {
    return res.status(400).json({ error: "A valid senior_id is required." });
  }

  if (requestedCode && !/^\d{6}$/.test(requestedCode)) {
    return res.status(400).json({ error: "A valid 6-digit link code is required." });
  }

  db.query("SELECT senior_id FROM Senior WHERE senior_id = ? LIMIT 1", [senior_id], (findErr, rows) => {
    if (findErr) return res.status(500).json({ error: findErr.message || findErr });
    if (!rows.length) return res.status(404).json({ error: "Senior not found." });

    saveUniqueLinkCode(senior_id, 8, (err, linkCode) => {
      if (err) return res.status(500).json({ error: err.message || err });
      res.json({
        message: "Senior link code generated successfully.",
        senior_id: Number(senior_id),
        link_code: linkCode,
      });
    }, requestedCode);
  });
});

router.get("/:senior_id/caregivers", (req, res) => {
  const { senior_id } = req.params;

  if (!senior_id || Number.isNaN(Number(senior_id))) {
    return res.status(400).json({ error: "A valid senior_id is required." });
  }

  const sql = `
    SELECT ua.*
    FROM User_Account ua
    JOIN Senior_has_Caregiver shc
      ON ua.user_id = shc.caregiver_id
    WHERE shc.senior_id = ?
    ORDER BY ua.full_name ASC
  `;

  db.query(sql, [senior_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message || err });
    res.json(rows);
  });
});

router.delete("/:senior_id/caregivers/:caregiver_id", (req, res) => {
  const { senior_id, caregiver_id } = req.params;

  if (!senior_id || Number.isNaN(Number(senior_id))) {
    return res.status(400).json({ error: "A valid senior_id is required." });
  }

  if (!caregiver_id || Number.isNaN(Number(caregiver_id))) {
    return res.status(400).json({ error: "A valid caregiver_id is required." });
  }

  const sql = `
    DELETE FROM Senior_has_Caregiver
    WHERE senior_id = ? AND caregiver_id = ?
  `;

  db.query(sql, [senior_id, caregiver_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message || err });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "This senior is not linked to your caregiver account." });
    }

    res.json({
      message: "Senior removed from caregiver account.",
      senior_id: Number(senior_id),
      caregiver_id: Number(caregiver_id),
    });
  });
});

/**
 * GET MEDICAL CONDITIONS
 */
router.get("/:senior_id/medical-conditions", async (req, res) => {
  try {
    await seniorMedicalConditionColumnsReady;

    const sql = `
      SELECT
        mc.condition_id,
        mc.condition_name,
        smc.severity_level,
        smc.medication_required,
        smc.diagnosed_date
      FROM Senior_Medical_Condition smc
      JOIN Medical_Condition mc
        ON smc.condition_id = mc.condition_id
      WHERE smc.senior_id = ?
      ORDER BY smc.diagnosed_date DESC, mc.condition_name ASC
    `;

    const results = await runQuery(sql, [req.params.senior_id]);
    res.json(Array.isArray(results) ? results : []);
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
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
  const validationError = validateNokPayload({ full_name, phone_number, email });

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

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
          capitalizeWords(full_name),
          String(phone_number || "").trim(),
          String(email || "").trim().toLowerCase(),
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
          capitalizeWords(full_name),
          String(phone_number || "").trim(),
          String(email || "").trim().toLowerCase(),
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

router.put('/:senior_id/medical-condition', async (req, res) => {
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

  await seniorMedicalConditionColumnsReady;

  const upsertCondition = (resolvedConditionId) => {
    if (!resolvedConditionId) {
      return res.status(400).json({ error: 'A valid condition_id or customCondition is required.' });
    }

    const sql = `
      INSERT INTO Senior_Medical_Condition
        (senior_id, condition_id, diagnosed_date, severity_level, medication_required)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        condition_id = VALUES(condition_id),
        diagnosed_date = VALUES(diagnosed_date),
        severity_level = VALUES(severity_level),
        medication_required = VALUES(medication_required)
    `;

    db.query(sql, [
      seniorId,
      resolvedConditionId,
      diagnosed_date || null,
      severity_level || null,
      medication_required || null,
    ], (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: 'Senior medical condition saved successfully.' });
    });
  };

  if (customCondition && !condition_id) {
    const insertConditionSql = `
      INSERT INTO Medical_Condition (condition_name)
      VALUES (?)
    `;

    db.query(
      insertConditionSql,
      [customCondition],
      (err, result) => {
        if (err) return res.status(500).json(err);
        upsertCondition(result.insertId);
      }
    );
  } else {
    upsertCondition(condition_id);
  }
});

router.put('/:senior_id/medical-conditions/sync', async (req, res) => {
  const seniorId = req.params.senior_id;
  const conditions = Array.isArray(req.body?.conditions) ? req.body.conditions : [];

  if (!seniorId) {
    return res.status(400).json({ error: 'Senior ID is required.' });
  }

  try {
    await seniorMedicalConditionColumnsReady;

    const resolved = [];

    for (const item of conditions) {
      if (!item || typeof item !== 'object') continue;

      const diagnosedDate = item.diagnosed_date || null;
      const severityLevel = item.severity_level || null;
      const medicationRequired = item.medication_required || null;

      let conditionId = item.condition_id ? Number(item.condition_id) : null;

      if (!conditionId && item.customCondition) {
        const insertConditionSql = `
          INSERT INTO Medical_Condition (condition_name)
          VALUES (?)
        `;

        const insertResult = await runQuery(insertConditionSql, [
          item.customCondition,
        ]);

        conditionId = insertResult.insertId;
      }

      if (!conditionId) continue;

      resolved.push({
        condition_id: conditionId,
        diagnosed_date: diagnosedDate,
        severity_level: severityLevel,
        medication_required: medicationRequired,
      });
    }

    await runQuery(`DELETE FROM Senior_Medical_Condition WHERE senior_id = ?`, [seniorId]);

    for (const item of resolved) {
      const linkSql = `
        INSERT INTO Senior_Medical_Condition
          (senior_id, condition_id, diagnosed_date, severity_level, medication_required)
        VALUES (?, ?, ?, ?, ?)
      `;

      await runQuery(linkSql, [
        seniorId,
        item.condition_id,
        item.diagnosed_date,
        item.severity_level,
        item.medication_required,
      ]);
    }

    const fetchSql = `
      SELECT
        mc.condition_id,
        mc.condition_name,
        smc.severity_level,
        smc.medication_required,
        smc.diagnosed_date
      FROM Senior_Medical_Condition smc
      JOIN Medical_Condition mc
        ON smc.condition_id = mc.condition_id
      WHERE smc.senior_id = ?
      ORDER BY smc.diagnosed_date DESC, mc.condition_name ASC
    `;

    const updatedConditions = await runQuery(fetchSql, [seniorId]);

    res.json({
      message: 'Medical conditions synced successfully.',
      conditions: updatedConditions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

/**
 * CREATE NOK and link to senior
 */
router.post('/:senior_id/nok', (req, res) => {
  const seniorId = req.params.senior_id;
  const { full_name, phone_number, email, relationship_to_senior } = req.body;
  const validationError = validateNokPayload({ full_name, phone_number, email });

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const insertSql = `
    INSERT INTO NOK (full_name, phone_number, email, relationship_to_senior)
    VALUES (?, ?, ?, ?)
  `;

  db.query(insertSql, [
    capitalizeWords(full_name),
    String(phone_number || "").trim(),
    String(email || "").trim().toLowerCase(),
    relationship_to_senior,
  ], (err, result) => {
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
