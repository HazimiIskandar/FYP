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
// WORKFLOW_ROUTE ASSIGNMENT (per linkage state, NOT from client body):
//   • senior has caregiver + NOK linked  → "caregiver_nok_aic" (existing default)
//   • senior has caregiver only linked   → "caregiver_aic"
//   • senior has neither linked          → `null`
//                                       ServiceNow u_workflow_route stays
//                                       empty for unlinked accounts so the
//                                       SN flow does not silently promote
//                                       incomplete-profile seniors into the
//                                       escalation path. Telegram falls
//                                       back to "no chat_ids filled in —
//                                       skipping" (its built-in behaviour).
// The client's `notify_bucket` body field is INTENTIONALLY IGNORED —
// linkage tables are the authoritative source of truth for routing.
// ---------------------------------------------------------------------------------

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");
const { dispatchEngagement } = require("../services/notificationFanout");

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

  const currentHour = new Date().getHours();
  const isMorning = currentHour < 16;

  // `let` so the linkage-aware assignee below can mutate it before the
  // response body / dispatchEngagement fire.
  let notify_bucket = null;

  // Combined "duplicate check + linkage lookup". One MySQL round-trip
  // returns the same-of-day flag AND the senior's actual caregiver / NOK
  // counts so we can derive the workflow_route. True to the per-request
  // contract — `req.body.notify_bucket` is deliberately not consulted;
  // linkage is the authoritative source.
  const findTodayAndLinkageSql = `
    SELECT
      EXISTS(
        SELECT 1 FROM Daily_CheckIn
        WHERE senior_id = ?
          AND DATE(checkin_timestamp) = CURDATE()
          AND HOUR(checkin_timestamp) ${isMorning ? "< 16" : ">= 16"}
      ) AS already_checked,
      (SELECT COUNT(*) FROM Senior_has_Caregiver WHERE senior_id = ?) AS caregivers,
      (SELECT COUNT(*) FROM Senior_has_NOK         WHERE senior_id = ?) AS noks
    FROM (SELECT 1) AS src
  `;

  db.query(findTodayAndLinkageSql, [senior_id, senior_id, senior_id], (todayErr, todayRows) => {
    if (todayErr)
      return res.status(500).json({ error: todayErr.message || todayErr });

    // The combined query always returns one row. Pull the duplicate flag
    // + linkage counts from `todayRows[0]` and short-circuit if the
    // senior has already checked in today.
    const firstRow = (todayRows && todayRows[0]) || {};

    if (Number(firstRow.already_checked) > 0) {
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

    // Derive workflow_route from the senior's actual caregiver / NOK
    // linkage state. `req.body.notify_bucket` is intentionally ignored —
    // the linkage tables are the authoritative source of truth for
    // routing. Stops new profiles (no caregiver + no NOK linked) from
    // being silently bucketed into the default `caregiver_nok_aic`
    // escalation path.
    const caregivers = Number(firstRow.caregivers) || 0;
    const noks = Number(firstRow.noks) || 0;
    if (caregivers > 0 && noks > 0) {
      notify_bucket = "caregiver_nok_aic";
    } else if (caregivers > 0) {
      notify_bucket = "caregiver_aic";
    } else {
      // No caregiver AND no NOK linked — leave bucket null so
      // ServiceNow's u_workflow_route is stored empty (see
      // services/servicenow.js buildPayload). Telegram silently skips
      // because telegramRecipients[null] is undefined → empty chat_ids
      // → no-op (handled inside telegramService.js).
      notify_bucket = null;
    }

    console.log(
      "[checkin] linkage-derived bucket senior_id=" + String(senior_id) +
        " caregivers=" + caregivers +
        " noks=" + noks +
        " bucket=" + (notify_bucket == null ? "null" : notify_bucket)
    );

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
                .json({ error: insertErr.message || insertErr });      const newCheckinId =
            insertResult && Number(insertResult.insertId)
              ? Number(insertResult.insertId)
              : null;

      // Auto-resolve any "Missed Morning/Evening Check-In" Emergency_Event
      // rows for this senior that are still 'Open'. Without this UPDATE,
      // App.js → getDerivedStatus sees the still-'Open' event and
      // short-circuits to 'Urgent' on the caregiver side, so the roster
      // shows red/yellow "Pending check-in" / "Missed check-in" tiles
      // even though THIS check-in just succeeded.
      //
      // Past-day scope: this UPDATE intentionally does NOT scope to
      // today's CURDATE(). A current successful check-in is conclusive
      // proof the senior is OK right now, so prior 'Open'
      // Missed%Check-In rows for the same senior (yesterday or earlier)
      // become Resolved too. The historical record is still preserved
      // via created_at (never mutated) and the Escalation_History audit
      // table.
      //
      // Idempotency: 'LOWER(IFNULL(event_status, '')) NOT IN
      // (resolved,closed,cancelled)' so re-running the resolution on an
      // already-settled event is a no-op regardless of casing variant
      // (resolved / RESOLVED / Resolved all match).
      //
      // Fire-and-forget: a housekeeping failure logs but does NOT 500
      // the response — the Daily_CheckIn row already committed so the
      // senior's check-in is recorded; the caregiver simply catches up
      // on the next 60-second background poll or on a screen-focus
      // refresh.
      const resolveMissedSql = `
        UPDATE Emergency_Event
        SET event_status = 'Resolved'
        WHERE senior_id = ?
          AND event_type LIKE 'Missed%Check-In'
          -- LOWER() wrap makes the comparison case-safe: escalation writes
          -- 'Resolved' (the canonical form) but a future route or manual
          -- admin tool could write 'resolved' / 'RESOLVED'. Re-running the
          -- resolution on an already-settled event stays a no-op instead
          -- of bouncing the row's status back to 'Resolved' after a
          -- different code-path edited it.
          AND LOWER(IFNULL(event_status, '')) NOT IN ('resolved','closed','cancelled')
          -- Past-day logic: intentionally NO 'DATE(created_at) = CURDATE()'
          -- constraint. A current successful check-in is conclusive proof the senior
          -- is OK right now, so prior 'Open' Missed%Check-In rows for the
          -- same senior (yesterday, day-before, etc.) become Resolved
          -- too. The original DATE constraint left every past day's
          -- missed-check-in escalation 'Open' permanently, which kept
          -- surfacing as 'Urgent' on the caregiver side and made the
          -- Status page display "Pending check-in" forever for any
          -- senior who missed any prior morning. The historical record
          -- is still preserved via 'created_at' (never mutated) and
          -- via the Escalation_History audit table.
      `;

      db.query(resolveMissedSql, [senior_id], (resolveErr) => {
        if (resolveErr) {
          console.error(
            "[checkin] failed to auto-resolve prior Missed Check-In events for senior_id=" +
              String(senior_id) + ":",
            resolveErr.message || resolveErr
          );
        }
      });

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

                        console.log(
                          "[checkin] post-response scheduling fanout checkin_id=" +
                            String(newCheckinId) +
                            " senior_id=" + String(senior_id) +
                            " bucket=" + notify_bucket
                        );

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
