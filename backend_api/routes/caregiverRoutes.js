const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/link-senior', (req, res) => {
  const { link_code, caregiver_id } = req.body;

  if (!link_code || !/^\d{6}$/.test(link_code)) {
    return res.status(400).json({ error: 'A valid 6-digit link code is required.' });
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
      SELECT user_id
      FROM User_Account
      WHERE user_id = ? AND role_id = 2
      LIMIT 1
    `;

    db.query(verifyCaregiverSql, [caregiver_id], (caregiverErr, caregiverRows) => {
      if (caregiverErr) return res.status(500).json({ error: caregiverErr.message || caregiverErr });
      if (!caregiverRows.length) {
        return res.status(403).json({ error: 'Invalid caregiver account.' });
      }

      const linkSql = `
        INSERT INTO Senior_has_Caregiver (senior_id, caregiver_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE caregiver_id = VALUES(caregiver_id)
      `;

      db.query(linkSql, [senior_id, caregiver_id], (linkErr) => {
        if (linkErr) return res.status(500).json({ error: linkErr.message || linkErr });
        res.json({ message: 'Senior linked to caregiver successfully.', senior_id });
      });
    });
  });
});

module.exports = router;
