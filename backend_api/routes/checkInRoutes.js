// ---------------------------------------------------------------------------------
// POST /checkin - daily check-in for a senior.
//
// On a successful Daily_CheckIn INSERT, the deepest success branch schedules
// `fanOutCheckIn(...)` inside `setImmediate(...)` — the React Native client gets
// its response instantly and the Notification audit row + Telegram message +
// ServiceNow POST happen off the response path.
//
// The fan-out helper is Promise.allSettled-based, never throws, and falls back
// gracefully when TELEGRAM_BOT_TOKEN / SN_USERNAME / SN_PASSWORD env vars are
// unset (each sink self-silently skips). MySQL is the source of truth.
//
// Accepts an optional `notify_bucket` in the request body, validated against a
// fixed allowlist. Defaults to "caregiver_nok_aic". See telegramRecipients.js
// for the chat-id arrays tied to each bucket.
// ---------------------------------------------------------------------------------

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");
const { createNotification } = require("../services/notificationService");
const { notifyCheckIn } = require("../services/telegramService");
const servicenow = require("../services/servicenow");

const NOTIFY_BUCKETS = ["caregiver_nok_aic", "caregiver_aic"];
const DEFAULT_NOTIFY_BUCKET = "caregiver_nok_aic";

// ----- HELPERS -----------------------------------------------------------------
function dbQueryAsync(sql, params) {
  return new Promise((resolve) => {
    db.query(sql, params, (err, rows) => {
      if (err) {
        // Swallow — fan-out must NEVER break the user-acknowledged check-in.
        console.warn(
          "[checkin] helper query failed:",
          (sql || "").replace(/\s+/g, " ").trim().slice(0, 80),
          err.message
        );
        // Always resolve to [] so callers can rely on "array of rows".
        return resolve([]);
      }
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function normalizeBucket(raw) {
  return NOTIFY_BUCKETS.includes(raw) ? raw : DEFAULT_NOTIFY_BUCKET;
}

// Fan out: notification row + Telegram message + ServiceNow row.
// All three are independent — Promise.allSettled lets a sink fail without
// halting the others. Never throws to the caller.
async function fanOutCheckIn(checkinId, seniorId, bucket, newStreak, newTotalPoints) {
  try {
    // ---------- 1. Enrich from MySQL (parallel) ----------
    const seniorRows = await dbQueryAsync(
      `SELECT ua.full_name
       FROM Senior s
       JOIN User_Account ua ON ua.user_id = s.user_id
       WHERE s.senior_id = ?
       LIMIT 1`,
      [seniorId]
    );
    const seniorRow = (seniorRows && seniorRows[0]) || {};
    const seniorName = seniorRow.full_name || "A senior";

    const [
      caregiverRows,
      nokRows,
      aicCountRows,
      caregiverCountRows,
      nokCountRows,
    ] = await Promise.all([
      // First caregiver name (for the audit row's recipient_name).
      dbQueryAsync(
        `SELECT ua.full_name
         FROM Senior_has_Caregiver sc
         JOIN User_Account ua ON ua.user_id = sc.caregiver_id
         WHERE sc.senior_id = ?
         ORDER BY sc.caregiver_id ASC
         LIMIT 1`,
        [seniorId]
      ),
      // First NOK name (kept for future enrichment; not currently used by sinks).
      dbQueryAsync(
        `SELECT n.full_name
         FROM Senior_has_NOK sn
         JOIN NOK n ON n.nok_id = sn.nok_id
         WHERE sn.senior_id = ?
         ORDER BY sn.nok_id ASC
         LIMIT 1`,
        [seniorId]
      ),
      // AIC staff counts (real COUNT(*) for the ServiceNow u_aic_staff_count).
      dbQueryAsync(
        `SELECT COUNT(*) AS n
         FROM Senior_has_AIC_Staff
         WHERE senior_id = ?`,
        [seniorId]
      ),
      // Caregiver counts (real COUNT(*) for the ServiceNow u_caregiver_count).
      dbQueryAsync(
        `SELECT COUNT(*) AS n
         FROM Senior_has_Caregiver
         WHERE senior_id = ?`,
        [seniorId]
      ),
      // NOK counts (real COUNT(*) for the ServiceNow u_nok_count).
      dbQueryAsync(
        `SELECT COUNT(*) AS n
         FROM Senior_has_NOK
         WHERE senior_id = ?`,
        [seniorId]
      ),
    ]);

    const caregiverName =
      (caregiverRows && caregiverRows[0] && caregiverRows[0].full_name) ||
      "Assigned caregiver";
    const nokName =
      (nokRows && nokRows[0] && nokRows[0].full_name) || null;
    const aicCount =
      (aicCountRows && aicCountRows[0] && Number(aicCountRows[0].n)) || 0;
    const caregiverCount =
      (caregiverCountRows && caregiverCountRows[0] && Number(caregiverCountRows[0].n)) || 0;
    const nokCount =
      (nokCountRows && nokCountRows[0] && Number(nokCountRows[0].n)) || 0;

    // ---------- 2. Build payloads for each sink ----------
    const eventType = "Daily Check-In";
    const imOkay = true;
    const checkinTimestamp = new Date().toISOString();

    const snCtx = {
      senior_id: seniorId,
      senior_full_name: seniorName,
      checkin_timestamp: checkinTimestamp,
      event_type: eventType,
      im_okay: imOkay,
      workflow_route: bucket,
      aic_staff_count: aicCount,
      caregiver_count: caregiverCount,
      nok_count: nokCount,
    };

    const tgPayload = {
      seniorFullName: seniorName,
      eventType,
      imOkay,
      checkinTimestamp,
    };

    // ---------- 3. Fire all three sinks in parallel ----------
    await Promise.allSettled([
      // notificationService.createNotification is callback-style / fires
      // asynchronously; we don't await the underlying MySQL insert because
      // its own callback logs errors. We just want it dispatched.
      Promise.resolve(
        createNotification(
          bucket,
          caregiverName,
          seniorId,
          null, // event_id
          checkinId
        )
      ),
      notifyCheckIn(bucket, tgPayload),
      servicenow.createCheckInResponse(snCtx),
    ]);

    // "dispatched" (not "completed") — because the Notification INSERT
    // callback runs after this log fires, and Telegram/ServiceNow return
    // values are already logged inside their own services.
    console.log(
      "[checkin] fan-out dispatched checkin_id=" +
        String(checkinId) +
        " senior_id=" +
        String(seniorId) +
        " bucket=" +
        bucket +
        " caregivers=" +
        caregiverCount +
        " noks=" +
        nokCount +
        " aic=" +
        aicCount +
        " streak=" +
        newStreak +
        " total_points=" +
        newTotalPoints
    );
  } catch (fatalErr) {
    console.warn(
      "[checkin] fan-out unexpected failure:",
      fatalErr && fatalErr.message ? fatalErr.message : String(fatalErr)
    );
  }
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
      // Already-checked path: do NOT fan out (this is a duplicate, not a new event).
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
                          fanOutCheckIn(
                            newCheckinId,
                            senior_id,
                            notify_bucket,
                            currentStreak,
                            totalPoints
                          );
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
