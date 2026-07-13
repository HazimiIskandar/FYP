const express = require("express");
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");
const { dispatchEngagement } = require("../services/notificationFanout");

const router = express.Router();

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

const ensureRewardRow = async (seniorId) => {
  const rewardRows = await runQuery(
    `
      SELECT reward_id
      FROM Reward_Streak
      WHERE senior_id = ?
      ORDER BY reward_id ASC
      LIMIT 1
    `,
    [seniorId]
  );

  if (rewardRows.length > 0) {
    return rewardRows[0].reward_id;
  }

  const insertResult = await runQuery(
    "INSERT INTO Reward_Streak (senior_id, current_streak, total_points) VALUES (?, 0, 0)",
    [seniorId]
  );

  return insertResult.insertId;
};

const ensureDailyCheckInForActivity = async (seniorId) => {
  const existingRows = await runQuery(
    `
      SELECT checkin_id
      FROM Daily_CheckIn
      WHERE senior_id = ? AND DATE(checkin_timestamp) = CURDATE()
      LIMIT 1
    `,
    [seniorId]
  );

  if (existingRows.length > 0) {
    return { created: false, checkin_id: existingRows[0].checkin_id };
  }

  const rewardId = await ensureRewardRow(seniorId);
  const insertResult = await runQuery(
    `
      INSERT INTO Daily_CheckIn (senior_id, checkin_status, reward_id)
      VALUES (?, 'Completed', ?)
    `,
    [seniorId, rewardId]
  );

  return { created: true, checkin_id: insertResult.insertId };
};

const syncRewardStreak = async (seniorId) => {
  const [checkInRows, communityRows] = await Promise.all([
    runQuery(
      `
        SELECT checkin_timestamp, checkin_status
        FROM Daily_CheckIn
        WHERE senior_id = ?
        ORDER BY checkin_timestamp DESC
      `,
      [seniorId]
    ),
    runQuery(
      `
        SELECT activity_date, participation_status
        FROM Community_Hub
        WHERE senior_id = ?
        ORDER BY activity_date DESC
      `,
      [seniorId]
    ),
  ]);

  const currentStreak = calculateCurrentStreak([...checkInRows, ...communityRows]);
  const rewardId = await ensureRewardRow(seniorId);

  await runQuery("UPDATE Reward_Streak SET current_streak = ? WHERE reward_id = ?", [
    currentStreak,
    rewardId,
  ]);

  return currentStreak;
};

/**
 * GET /community/activities/all
 * Fetch all community hub activities for all seniors
 */
router.get("/activities/all", (req, res) => {
  const query = `
    SELECT 
      activity_id,
      senior_id,
      activity_name,
      activity_type,
      activity_date,
      participation_status
    FROM Community_Hub
    ORDER BY activity_date DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching all community activities:", err);
      return res.status(500).json({ error: "Failed to fetch activities" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/**
 * GET /community/activities/:senior_id
 * Fetch all community hub activities for a senior
 */
router.get("/activities/:senior_id", (req, res) => {
  const { senior_id } = req.params;

  // Skip if trying to fetch 'all'
  if (senior_id === 'all') {
    return res.next?.();
  }

  const query = `
    SELECT 
      activity_id,
      senior_id,
      activity_name,
      activity_type,
      activity_date,
      participation_status
    FROM Community_Hub
    WHERE senior_id = ?
    ORDER BY activity_date DESC
  `;

  db.query(query, [senior_id], (err, results) => {
    if (err) {
      console.error("Error fetching community activities:", err);
      return res.status(500).json({ error: "Failed to fetch activities" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/**
 * POST /community/record-activity
 * Record a community game activity for a senior
 * Body: { senior_id, activity_name, activity_type, participation_status }
 */
router.post("/record-activity", async (req, res) => {
  const { senior_id, activity_name = "Memory Game", activity_type = "Game", participation_status = "Completed" } = req.body;

  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  try {
    const existingRows = await runQuery(
      `
        SELECT activity_id
        FROM Community_Hub
        WHERE senior_id = ?
          AND activity_name = ?
          AND activity_type = ?
          AND DATE(activity_date) = CURDATE()
        ORDER BY activity_id ASC
        LIMIT 1
      `,
      [senior_id, activity_name, activity_type]
    );

    let activityId = existingRows[0]?.activity_id;
    let activityCreated = false;

    if (!activityId) {
      const insertResult = await runQuery(
        `
          INSERT INTO Community_Hub (senior_id, activity_name, activity_type, activity_date, participation_status)
          VALUES (?, ?, ?, NOW(), ?)
        `,
        [senior_id, activity_name, activity_type, participation_status]
      );

      activityId = insertResult.insertId;
      activityCreated = true;
    }

    const checkIn = await ensureDailyCheckInForActivity(senior_id);
    const currentStreak = await syncRewardStreak(senior_id);

    res.json({
      success: true,
      activity_id: activityId,
      activity_created: activityCreated,
      checkin_id: checkIn.checkin_id,
      checkin_created: checkIn.created,
      current_streak: currentStreak,
    });

    // Diagnostic log so future render-log dives can tell whether this
    // puzzle press is also the senior's FIRST engagement of the day
    // (created:true -> fan-out fires) or a duplicate of an earlier
    // I'm-okay engagement today (created:false -> fan-out suppressed).
    // Companion log line lives inside dispatchEngagement
    // (`[fanout] invoked source=community ...`).
    console.log(
      "[community] record-activity checkin_created=" + (checkIn.created ? "true" : "false") +
        " checkin_id=" + String(checkIn.checkin_id) +
        " senior_id=" + String(senior_id) +
        " activity_created=" + (activityCreated ? "true" : "false") +
        " -> " + (checkIn.created ? "WILL fire fan-out" : "SKIP fan-out (already checked in today)")
    );

    // Fan-out is gated on `checkIn.created === true` so the senior gets
    // **exactly one** fan-out per (senior, day) regardless of source.
    // Together with the symmetric dedup in checkInRoutes.js (button
    // path), the user-visible semantic is:
    //
    //   • Senior pressed I'm-okay FIRST today
    //     → button path's findTodaySql returned the row, fired its
    //       fan-out once, inserted Daily_CheckIn already. The puzzle
    //       path now finds that row, returns created:false, and skips
    //       its own fan-out. No duplicate Notification / SN / Telegram
    //       pings. ✓
    //   • Senior missed I'm-okay and ONLY played the puzzle today
    //     → ensureDailyCheckInForActivity INSERTs a fresh Daily_CheckIn
    //       here, returns created:true, this branch fires the fan-out
    //       with event_type="Community Game". The Senior's day is
    //       captured via the puzzle path. ✓
    //
    // The CommunityScreen.js frontend dedups `recordedActivityKeyRef.current
    // = ${seniorId}:${getTodayKey()}` so each (senior, day) only POSTs
    // once even if the senior replays the puzzle multiple times, making
    // the backend gate the authoritative per-day ceiling.
    if (checkIn.created) {
      setImmediate(() => {
        dispatchEngagement({
          checkinId: checkIn.checkin_id,
          seniorId: senior_id,
          bucket: "caregiver_nok_aic",
          newStreak: currentStreak,
          newTotalPoints: undefined, // community path doesn't compute points
          eventType: "Community Game",
          imOkay: true,
          source: "community",
        });
      });
    }
  } catch (err) {
    console.error("Error recording activity:", err);
    res.status(500).json({ error: "Failed to record activity" });
  }
});

module.exports = router;
