const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");

// POST /checkin - daily check-in for a senior.
router.post("/", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { senior_id } = req.body;
  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  const findTodaySql = `
    SELECT checkin_id
    FROM Daily_CheckIn
    WHERE senior_id = ? AND DATE(checkin_timestamp) = CURDATE()
    LIMIT 1
  `;

  db.query(findTodaySql, [senior_id], (todayErr, todayRows) => {
    if (todayErr) return res.status(500).json({ error: todayErr.message || todayErr });
    if (todayRows.length > 0) {
      return res.json({ message: "Already checked in today" });
    }

    const findRewardSql = `
      SELECT reward_id, total_points
      FROM Reward_Streak
      WHERE senior_id = ?
      ORDER BY reward_id ASC
      LIMIT 1
    `;

    db.query(findRewardSql, [senior_id], (rewardErr, rewardRows) => {
      if (rewardErr) return res.status(500).json({ error: rewardErr.message || rewardErr });

      const createCheckIn = (rewardId, currentPoints) => {
        const insertCheckInSql = `
          INSERT INTO Daily_CheckIn (senior_id, checkin_status, reward_id)
          VALUES (?, 'Completed', ?)
        `;

        db.query(insertCheckInSql, [senior_id, rewardId], (insertErr) => {
          if (insertErr) return res.status(500).json({ error: insertErr.message || insertErr });

          const checkInHistorySql = `
            SELECT checkin_timestamp, checkin_status
            FROM Daily_CheckIn
            WHERE senior_id = ?
            ORDER BY checkin_timestamp DESC
          `;

          db.query(checkInHistorySql, [senior_id], (historyErr, historyRows) => {
            if (historyErr) return res.status(500).json({ error: historyErr.message || historyErr });

            const communityHistorySql = `
              SELECT activity_date, participation_status
              FROM Community_Hub
              WHERE senior_id = ?
              ORDER BY activity_date DESC
            `;

            db.query(communityHistorySql, [senior_id], (communityErr, communityRows) => {
              if (communityErr) return res.status(500).json({ error: communityErr.message || communityErr });

              const currentStreak = calculateCurrentStreak([...historyRows, ...communityRows]);
              const totalPoints = Number(currentPoints || 0);
              const updateRewardSql = `
                UPDATE Reward_Streak rs
                JOIN (
                  SELECT senior_id, MAX(checkin_timestamp) AS latest
                  FROM Daily_CheckIn
                  WHERE senior_id = ?
                ) dc
                  ON dc.senior_id = rs.senior_id
                SET rs.current_streak = ?,
                    rs.last_checkin = DATE(dc.latest),
                    rs.\`timestamp\` = dc.latest
                WHERE rs.reward_id = ?
              `;

              db.query(updateRewardSql, [senior_id, currentStreak, rewardId], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: updateErr.message || updateErr });

                res.json({
                  message: "Check-in successful",
                  current_streak: currentStreak,
                  total_points: totalPoints,
                });
              });
            });
          });
        });
      };

      if (rewardRows.length > 0) {
        createCheckIn(rewardRows[0].reward_id, rewardRows[0].total_points);
        return;
      }

      const insertRewardSql = `
        INSERT INTO Reward_Streak (senior_id, current_streak, total_points)
        VALUES (?, 0, 0)
      `;

      db.query(insertRewardSql, [senior_id], (insertRewardErr, result) => {
        if (insertRewardErr) {
          return res.status(500).json({ error: insertRewardErr.message || insertRewardErr });
        }

        createCheckIn(result.insertId, 0);
      });
    });
  });
});

// GET /checkin/:senior_id - check-in history for one senior.
router.get("/:senior_id", (req, res) => {
  const sql = `
    SELECT *
    FROM Daily_CheckIn
    WHERE senior_id = ?
    ORDER BY checkin_timestamp DESC
  `;

  db.query(sql, [req.params.senior_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message || err });
    res.json(Array.isArray(result) ? result : []);
  });
});

module.exports = router;
