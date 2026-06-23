const express = require("express");
const db = require("../config/db");
const { calculateCurrentStreak } = require("../services/rewardService");

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
 * Record a community game completion for a senior
 * Body: { senior_id, activity_name, activity_type, participation_status }
 */
router.post("/record-activity", (req, res) => {
  const { senior_id, activity_name = "Memory Game", activity_type = "Game", participation_status = "Completed" } = req.body;

  if (!senior_id) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  const query = `
    INSERT INTO Community_Hub (senior_id, activity_name, activity_type, activity_date, participation_status)
    VALUES (?, ?, ?, NOW(), ?)
  `;

  db.query(query, [senior_id, activity_name, activity_type, participation_status], async (err, results) => {
    if (err) {
      console.error("Error recording activity:", err);
      return res.status(500).json({ error: "Failed to record activity" });
    }

    try {
      const checkIn = await ensureDailyCheckInForActivity(senior_id);
      const currentStreak = await syncRewardStreak(senior_id);
      res.json({
        success: true,
        activity_id: results.insertId,
        checkin_id: checkIn.checkin_id,
        checkin_created: checkIn.created,
        current_streak: currentStreak,
      });
    } catch (syncErr) {
      console.error("Error syncing community streak:", syncErr);
      res.json({ success: true, activity_id: results.insertId });
    }
  });
});

module.exports = router;
