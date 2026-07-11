const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");
const { triggerCheckIn } = require("../services/servicenow");
const { notifyCheckIn } = require("../services/telegramService");

// JOINs Senior → User_Account so we pass the senior's display name into
// both the ServiceNow trigger and the Telegram fan-out. Used inside
// fireCheckInIntegrations() below.
const seniorFullNameSql = `
  SELECT ua.full_name
  FROM Senior s
  JOIN User_Account ua ON ua.user_id = s.user_id
  WHERE s.senior_id = ?
  LIMIT 1
`;

// Detached side-effects fired the moment the MySQL Daily_CheckIn row
// lands. Both ServiceNow POST and Telegram fan-out run AFTER the
// MySQL commit, and are BEST-EFFORT — neither failure ever blocks
// the 200 response to the mobile app.
//
// Order is sequential (await chain) on purpose: we send the Telegram
// notifications first, capture how many of each role got pinged (even
// if the network actually fails — counts are computed before the send),
// then POST the SN record WITH those counts so the
// aic_staff_count / nok_count / caregiver_count columns reflect who
// we tried to notify.
//
// Both helpers never throw; the .catch() here is purely defensive.
function fireCheckInIntegrations(senior_id) {
  const checkinTimestampIso = new Date().toISOString();

  db.query(seniorFullNameSql, [senior_id], (nameErr, nameRows) => {
    const seniorFullName =
      nameRows && nameRows[0] && nameRows[0].full_name
        ? nameRows[0].full_name
        : `Senior #${senior_id}`;

    // "I'm Okay" press implies OK. The escalation hook is here so that
    // if a future mood toggle ever flips im_okay, we automatically
    // widen the recipient bucket to also page the next-of-kin.
    const imOkay = true;
    const workflowRoute = imOkay ? "caregiver_aic" : "caregiver_nok_aic";

    const basePayload = {
      seniorId: senior_id,
      seniorFullName,
      imOkay,
      eventType: "Daily Check-in",
      workflowRoute,
      checkinTimestamp: checkinTimestampIso,
    };

    notifyCheckIn(workflowRoute, basePayload)
      .then((counts) =>
        triggerCheckIn({
          ...basePayload,
          aic_staff_count: counts.aic_staff_count,
          caregiver_count: counts.caregiver_count,
          nok_count: counts.nok_count,
        })
      )
      .catch((err) => {
        console.error("[checkin] integration chain failed:", err);
      });
  });
}

// POST /checkin - daily check-in for a senior.
router.post("/", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { senior_id } = req.body;
  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  const currentHour = new Date().getHours();
  const isMorning = currentHour < 16;
  
  const findTodaySql = `
    SELECT checkin_id
    FROM Daily_CheckIn
    WHERE senior_id = ? 
      AND DATE(checkin_timestamp) = CURDATE()
      AND HOUR(checkin_timestamp) ${isMorning ? '< 16' : '>= 16'}
    LIMIT 1
  `;

  db.query(findTodaySql, [senior_id], (todayErr, todayRows) => {
    if (todayErr) return res.status(500).json({ error: todayErr.message || todayErr });
    if (todayRows.length > 0) {
      return res.json({ message: isMorning ? "Already checked in for the morning" : "Already checked in for the evening" });
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

          // MySQL committed — fire ServiceNow + Telegram side-effects
          // in parallel (fire-and-forget, never blocks res.json below).
          fireCheckInIntegrations(senior_id);

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
