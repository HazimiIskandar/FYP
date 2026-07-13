// ---------------------------------------------------------------------------------
// POST /checkin - daily check-in for a senior.
//
// On a successful Daily_CheckIn INSERT, the deepest success branch schedules
// `dispatchEngagement(...)` inside `setImmediate(...)` — the React Native
// client gets its response instantly and the Notification audit row +
// Telegram message + ServiceNow POST happen off the response path.
//
// All three downstream sinks are dispatched by the SHARED helper in
// `services/notificationFanout.js`, which does its own Promise.allSettled
// fan-out and falls back gracefully when TELEGRAM_BOT_TOKEN /
// SN_OAUTH_CLIENT_ID / SN_OAUTH_CLIENT_SECRET env vars are unset (each sink
// self-silently skips). MySQL is the source of truth.
//
// Accepts an optional `notify_bucket` in the request body, validated
// against a fixed allowlist. Defaults to "caregiver_nok_aic". See
// telegramRecipients.js for the chat-id arrays tied to each bucket.
// ---------------------------------------------------------------------------------

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");
const { dispatchEngagement } = require("../services/notificationFanout");

const NOTIFY_BUCKETS = ["caregiver_nok_aic", "caregiver_aic"];
const DEFAULT_NOTIFY_BUCKET = "caregiver_nok_aic";

function normalizeBucket(raw) {
  return NOTIFY_BUCKETS.includes(raw) ? raw : DEFAULT_NOTIFY_BUCKET;
}

// =============================================================================
// POST /checkin
// =============================================================================
router.post("/", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { senior_id } = req.body;
  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }
  const notify_bucket = normalizeBucket(req.body && req.body.notify_bucket);

  const currentHour = new Date().getHours();
  const isMorning = currentHour < 16;

  const findTodaySql = `
    SELECT checkin_id
    FROM Daily_CheckIn
    WHERE senior_id = ?
      AND DATE(checkin_timestamp) = CURDATE()
      AND HOUR(checkin_timestamp) ${isMorning ? "< 16" : ">= 16"}
    LIMIT 1
  `;

  db.query(findTodaySql, [senior_id], (todayErr, todayRows) => {
    if (todayErr)
      return res.status(500).json({ error: todayErr.message || todayErr });
    if (todayRows.length > 0) {
      // Already-checked path: do NOT fan out (this is a duplicate, not a
      // brand-new engagement). The community-game path has its own dedup
      // guard (only fires when it CREATED the day's check-in row), so
      // both routes converge on exactly one fan-out per (senior, day).
      return res.json({
        message: isMorning
          ? "Already checked in for the morning"
          : "Already checked in for the evening",
      });
    }

    const findRewardSql = `
      SELECT reward_id, total_points
      FROM Reward_Streak
      WHERE senior_id = ?
      ORDER BY reward_id ASC
      LIMIT 1
    `;

    db.query(findRewardSql, [senior_id], (rewardErr, rewardRows) => {
      if (rewardErr)
        return res.status(500).json({ error: rewardErr.message || rewardErr });

      const createCheckIn = (rewardId, currentPoints) => {
        const insertCheckInSql = `
          INSERT INTO Daily_CheckIn (senior_id, checkin_status, reward_id)
          VALUES (?, 'Completed', ?)
        `;

        db.query(
          insertCheckInSql,
          [senior_id, rewardId],
          (insertErr, insertResult) => {
            if (insertErr)
              return res
                .status(500)
                .json({ error: insertErr.message || insertErr });

            const newCheckinId =
              insertResult && Number(insertResult.insertId)
                ? Number(insertResult.insertId)
                : null;

            const checkInHistorySql = `
              SELECT checkin_timestamp, checkin_status
              FROM Daily_CheckIn
              WHERE senior_id = ?
              ORDER BY checkin_timestamp DESC
            `;

            db.query(
              checkInHistorySql,
              [senior_id],
              (historyErr, historyRows) => {
                if (historyErr)
                  return res
                    .status(500)
                    .json({ error: historyErr.message || historyErr });

                const communityHistorySql = `
                  SELECT activity_date, participation_status
                  FROM Community_Hub
                  WHERE senior_id = ?
                  ORDER BY activity_date DESC
                `;

                db.query(
                  communityHistorySql,
                  [senior_id],
                  (communityErr, communityRows) => {
                    if (communityErr)
                      return res
                        .status(500)
                        .json({ error: communityErr.message || communityErr });

                    const currentStreak = calculateCurrentStreak([
                      ...historyRows,
                      ...communityRows,
                    ]);
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

                    db.query(
                      updateRewardSql,
                      [senior_id, currentStreak, rewardId],
                      (updateErr) => {
                        if (updateErr)
                          return res
                            .status(500)
                            .json({ error: updateErr.message || updateErr });

                        // ✅ Respond to client FIRST, then schedule async fan-out.
                        res.json({
                          message: "Check-in successful",
                          current_streak: currentStreak,
                          total_points: totalPoints,
                          checkin_id: newCheckinId,
                          notify_bucket,
                        });

                        // Fire-and-forget. Never blocks the response.
                        setImmediate(() => {
                          dispatchEngagement({
                            checkinId: newCheckinId,
                            seniorId: senior_id,
                            bucket: notify_bucket,
                            newStreak: currentStreak,
                            newTotalPoints: totalPoints,
                            eventType: "Daily Check-In",
                            imOkay: true,
                            source: "checkin",
                          });
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      };

      if (rewardRows.length > 0) {
        createCheckIn(rewardRows[0].reward_id, rewardRows[0].total_points);
        return;
      }

      const insertRewardSql = `
        INSERT INTO Reward_Streak (senior_id, current_streak, total_points)
        VALUES (?, 0, 0)
      `;

      db.query(
        insertRewardSql,
        [senior_id],
        (insertRewardErr, result) => {
          if (insertRewardErr) {
            return res
              .status(500)
              .json({ error: insertRewardErr.message || insertRewardErr });
          }

          createCheckIn(result.insertId, 0);
        }
      );
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
