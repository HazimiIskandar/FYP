const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");

// POST /checkin — daily check-in for a senior
router.post("/", (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { senior_id } = req.body;
  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  // 1. Prevent duplicate check-in for today
  const findTodaySql = `
    SELECT checkin_id FROM Daily_CheckIn
    WHERE senior_id = ? AND DATE(checkin_timestamp) = CURDATE()
    LIMIT 1
  `;

  db.query(findTodaySql, [senior_id], (err, todayRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (todayRows.length > 0) {
      return res.json({ message: "Already checked in today" });
    }

    // 2. Ensure Reward_Streak row exists (required FK for Daily_CheckIn)
    const findRewardSql = `SELECT reward_id, current_streak, total_points FROM Reward_Streak WHERE senior_id = ? LIMIT 1`;

    db.query(findRewardSql, [senior_id], (err2, rewardRows) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const createCheckIn = (rewardId) => {
        // 3. Insert the check-in row
        const insertCheckinSql = `
          INSERT INTO Daily_CheckIn (senior_id, checkin_status, reward_id)
          VALUES (?, 'Completed', ?)
        `;

        db.query(insertCheckinSql, [senior_id, rewardId], (err3) => {
          if (err3) return res.status(500).json({ error: err3.message });

          // 4. Calculate real streak from check-in history
          const histSql = `SELECT checkin_timestamp FROM Daily_CheckIn WHERE senior_id = ? ORDER BY checkin_timestamp DESC`;

          db.query(histSql, [senior_id], (err4, histRows) => {
            if (err4) return res.status(500).json({ error: err4.message });

            const newStreak = calculateCurrentStreak(histRows);
            const CHECK_IN_POINTS = 10;
            const prevPoints = rewardRows[0] ? Number(rewardRows[0].total_points || 0) : 0;
            const newPoints = prevPoints + CHECK_IN_POINTS;

            // 5. Update streak and points
            const updateRewardSql = `
              UPDATE Reward_Streak SET current_streak = ?, total_points = ? WHERE senior_id = ?
            `;

            db.query(updateRewardSql, [newStreak, newPoints, senior_id], (err5) => {
              if (err5) return res.status(500).json({ error: err5.message });

              res.json({
                message: "Check-in successful",
                current_streak: newStreak,
                total_points: newPoints,
              });
            });
          });
        });
      };

      if (rewardRows.length > 0) {
        createCheckIn(rewardRows[0].reward_id);
      } else {
        // No Reward_Streak yet — create one first
        const insertRewardSql = `
          INSERT INTO Reward_Streak (senior_id, current_streak, total_points) VALUES (?, 0, 0)
        `;

        db.query(insertRewardSql, [senior_id], (err2b, result) => {
          if (err2b) return res.status(500).json({ error: err2b.message });
          createCheckIn(result.insertId);
        });
      }
    });
  });
});

// GET /:senior_id — check-in history
router.get("/:senior_id", (req, res) => {
  const sql = `
    SELECT * FROM Daily_CheckIn
    WHERE senior_id = ?
    ORDER BY checkin_timestamp DESC
  `;

  db.query(sql, [req.params.senior_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

module.exports = router;


// CHECK-IN
router.post("/", (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: "Invalid request body" });
    }

    const { senior_id } = req.body;

    if (!senior_id) {
        return res.status(400).json({ error: "senior_id is required" });
    }

    const findTodayCheckIn = `
        SELECT checkin_id
        FROM Daily_CheckIn
        WHERE senior_id = ?
            AND DATE(checkin_timestamp) = CURDATE()
        LIMIT 1
    `;

    const loadCheckins = `
        SELECT checkin_timestamp
        FROM Daily_CheckIn
        WHERE senior_id = ?
        ORDER BY checkin_timestamp DESC
    `;

    const loadReward = `
        SELECT reward_id, total_points
        FROM Reward_Streak
        WHERE senior_id = ?
        LIMIT 1
    `;

    const saveCheckIn = () => {
        db.query(loadReward, [senior_id], (rewardErr, rewardRows) => {
            if (rewardErr) return res.status(500).json(rewardErr);

            const insertOrContinue = (rewardId) => {
                const insertCheckInReward = `
                    INSERT INTO Daily_CheckIn (senior_id, checkin_status, reward_id)
                    VALUES (?, 'Completed', ?)
                `;

                db.query(insertCheckInReward, [senior_id, rewardId], (err3) => {
                    if (err3) return res.status(500).json(err3);

                    db.query(loadCheckins, [senior_id], (historyErr, historyRows) => {
                        if (historyErr) return res.status(500).json(historyErr);

                        const currentStreak = calculateCurrentStreak(historyRows);
                        const awardPoints = 10;

                        const rewardRow = rewardRows[0] || null;

                        if (!rewardRow) {
                            const insertReward = `
                                INSERT INTO Reward_Streak
                                (senior_id, current_streak, total_points, daily_points, daily_points_date, last_checkin_date)
                                VALUES (?, ?, ?, 0, NULL, CURDATE())
                            `;

                            db.query(insertReward, [senior_id, currentStreak, awardPoints], (insertErr, result) => {
                                if (insertErr) return res.status(500).json(insertErr);

                                const updateCheckInRewardSql = `
                                    UPDATE Daily_CheckIn
                                    SET reward_id = ?
                                    WHERE senior_id = ? AND DATE(checkin_timestamp) = CURDATE()
                                `;

                                db.query(updateCheckInRewardSql, [result.insertId, senior_id], (linkErr) => {
                                    if (linkErr) return res.status(500).json(linkErr);
                                    res.json({ message: "Check-in successful", current_streak: currentStreak, total_points: awardPoints });
                                });
                            });
                            return;
                        }

                        const nextTotalPoints = Number(rewardRow.total_points || 0) + awardPoints;

                        const updateReward = `
                            UPDATE Reward_Streak
                            SET current_streak = ?, total_points = ?, last_checkin_date = CURDATE()
                            WHERE senior_id = ?
                        `;

                        db.query(updateReward, [currentStreak, nextTotalPoints, senior_id], (updateErr) => {
                            if (updateErr) return res.status(500).json(updateErr);

                            res.json({
                                message: "Check-in successful",
                                current_streak: currentStreak,
                                total_points: nextTotalPoints,
                            });
                        });
                    });
                });
            };

            if (rewardRows.length === 0 || rewardRows[0].reward_id == null) {
                const insertReward = `
                    INSERT INTO Reward_Streak
                    (senior_id, current_streak, total_points, daily_points, daily_points_date, last_checkin_date)
                    VALUES (?, 0, 0, 0, NULL, NULL)
                `;

                db.query(insertReward, [senior_id], (insertErr, result) => {
                    if (insertErr) return res.status(500).json(insertErr);
                    insertOrContinue(result.insertId);
                });
                return;
            }

            insertOrContinue(rewardRows[0].reward_id);
        });
    };

    db.query(findTodayCheckIn, [senior_id], (err1, existingRows) => {
        if (err1) return res.status(500).json(err1);
        if (existingRows.length > 0) {
            return res.json({ message: "Already checked in today" });
        }

        saveCheckIn();
    });
});


// GET THE CHECK-IN HISTORY
router.get("/:senior_id", (req, res) => {
    const sql = `
        SELECT * 
        FROM Daily_CheckIn 
        WHERE senior_id = ?
        ORDER BY checkin_timestamp DESC
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

module.exports = router;