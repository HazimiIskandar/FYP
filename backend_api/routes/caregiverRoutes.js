const express = require('express');
const router = express.Router();
const db = require('../config/db');

const normalizeLinkCode = (value) => String(value || '').trim().toUpperCase();

// Maximum number of seniors a single caregiver is allowed to have linked
// at the same time. Surfaced on /caregiver/link-senior so a caregiver
// who tries to add a 6th senior is rejected with a clear, actionable
// error message instead of silently succeeding. Keep this in sync with
// the same constant on the RN side (`MAX_SENIORS_PER_CAREGIVER` in
// screens/CaregiverSeniorsListScreen.js) so the front-end banner and
// the back-end gate agree on the same number. Bumping the limit here
// without a matching front-end banner change would let caregivers add
// one more slot but the UI would still report them as over-limit —
// the two constants intentionally mirror each other for that reason.
const MAX_SENIORS_PER_CAREGIVER = 5;

router.post('/link-senior', (req, res) => {
  const link_code = normalizeLinkCode(req.body?.link_code);
  const { caregiver_id } = req.body;

  if (!/^[A-Z0-9]{6}$/.test(link_code)) {
    return res.status(400).json({ error: 'A valid 6-character link code is required.' });
  }

  if (!caregiver_id || Number.isNaN(Number(caregiver_id))) {
    return res.status(400).json({ error: 'Caregiver user ID is required.' });
  }

  const findSeniorSql = `
    SELECT senior_id
    FROM Senior_Link_Code
    WHERE link_code = ?
    LIMIT 1
  `;

  db.query(findSeniorSql, [link_code], (err, results) => {
    if (err) return res.status(500).json({ error: err.message || err });
    if (!results.length) {
      return res.status(404).json({ error: 'No senior found for that link code.' });
    }

    const senior_id = results[0].senior_id;

    const verifyCaregiverSql = `
      SELECT role_id
      FROM User_Account
      WHERE user_id = ?
      LIMIT 1
    `;

    db.query(verifyCaregiverSql, [caregiver_id], (caregiverErr, caregiverRows) => {
      if (caregiverErr) return res.status(500).json({ error: caregiverErr.message || caregiverErr });
      if (!caregiverRows.length || Number(caregiverRows[0].role_id) !== 2) {
        return res.status(403).json({ error: 'Only caregiver accounts can link to a senior.' });
      }

      // Capacity gate: count the caregiver's existing linkages BEFORE the
      // duplicate / link steps so an over-limit caregiver is rejected
      // deterministically regardless of whether the new code points to a
      // duplicate senior or a brand-new one. Without this guard, legacy
      // caregivers were free to keep adding seniors without bound,
      // making it impossible for a single caregiver to effectively
      // monitor their roster. We reject at_exactly the limit (>=) so a
      // caregiver who somehow ended up with 6+ linkage rows from a
      // previous version of the app can never grow further.
      const countSql = `
        SELECT COUNT(*) AS total
        FROM Senior_has_Caregiver
        WHERE caregiver_id = ?
      `;

      db.query(countSql, [caregiver_id], (countErr, countRows) => {
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

        const duplicateSql = `
          SELECT senior_id, caregiver_id
          FROM Senior_has_Caregiver
          WHERE senior_id = ? AND caregiver_id = ?
          LIMIT 1
        `;

        db.query(duplicateSql, [senior_id, caregiver_id], (duplicateErr, duplicateRows) => {
          if (duplicateErr) return res.status(500).json({ error: duplicateErr.message || duplicateErr });
          if (duplicateRows.length) {
            return res.status(409).json({ error: 'This senior is already linked to your caregiver account.' });
          }

          const linkSql = `
            INSERT INTO Senior_has_Caregiver (senior_id, caregiver_id)
            VALUES (?, ?)
          `;

          db.query(linkSql, [senior_id, caregiver_id], (linkErr) => {
            if (linkErr) return res.status(500).json({ error: linkErr.message || linkErr });
            res.status(201).json({
              message: 'Senior linked to caregiver successfully.',
              senior_id,
              caregiver_id,
              current_count: currentCount + 1,
              max_count: MAX_SENIORS_PER_CAREGIVER,
            });
          });
        });
      });
    });
  });
});

router.get('/:caregiver_id/seniors', (req, res) => {
  const { caregiver_id } = req.params;

  if (!caregiver_id || Number.isNaN(Number(caregiver_id))) {
    return res.status(400).json({ error: 'Caregiver user ID is required.' });
  }

  // LEFT JOIN User_Account (instead of INNER JOIN) so that a missing or
  // orphaned User_Account row for a linked senior cannot cause that senior
  // to silently disappear from the caregiver's roster. Previously an
  // INNER JOIN here manifested as Amanda Lee's caregiver portal showing
  // 0 seniors even though Senior_has_Caregiver held 5 linkage rows --
  // any transient inconsistency between the linkage table and the User_Account
  // row would drop the row entirely before it reached the front-end.
  const sql = `
    SELECT
      s.senior_id,
      s.user_id,
      s.preferred_checkin_time,
      YEAR(CURDATE()) - YEAR(ua.dob) - (DATE_FORMAT(ua.dob, '%m%d') > DATE_FORMAT(CURDATE(), '%m%d')) AS age,
      ua.full_name,
      ua.phone_number,
      ua.email,
      ua.dob,
      ua.gender,
      ua.address,
      ua.postal_code,
      ua.unit_number
    FROM Senior s
    JOIN Senior_has_Caregiver shc
      ON s.senior_id = shc.senior_id
    LEFT JOIN User_Account ua
      ON s.user_id = ua.user_id
    WHERE shc.caregiver_id = ?
    -- Push NULL full_names (orphaned senior) to the bottom of the roster
    -- rather than letting MySQL sort them to the top by default for ASC.
    -- This keeps Amanda's 5 named seniors in alphabetical order, with any
    -- accidentally-left-joined NULL row showing last and easy to spot.
    ORDER BY ua.full_name IS NULL ASC, ua.full_name ASC
  `;

  db.query(sql, [caregiver_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message || err });
    res.json(rows);
  });
});

module.exports = router;
