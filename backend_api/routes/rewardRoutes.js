const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { calculateCurrentStreak, toDateKey } = require("../services/rewardService");

const DAILY_GAME_POINT_CAP = 50;
const KOPI_COST = 1500;

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

const ensureRewardColumns = async () => {
  try {
    const columns = await runQuery("SHOW COLUMNS FROM Reward_Streak");
    const columnNames = new Set(columns.map((column) => column.Field));
    const alterations = [];

    if (!columnNames.has("daily_points")) {
      alterations.push("ADD COLUMN daily_points INT NOT NULL DEFAULT 0");
    }
    if (!columnNames.has("daily_points_date")) {
      alterations.push("ADD COLUMN daily_points_date DATE NULL");
    }
    if (!columnNames.has("last_checkin")) {
      alterations.push("ADD COLUMN `last_checkin` DATE NULL");
    }
    if (!columnNames.has("timestamp")) {
      alterations.push("ADD COLUMN `timestamp` TIMESTAMP NULL");
    }

    for (const alteration of alterations) {
      await runQuery(`ALTER TABLE Reward_Streak ${alteration}`);
    }
  } catch (err) {
    console.error("Failed to prepare Reward_Streak columns:", err.message || err);
  }
};

const rewardColumnsReady = ensureRewardColumns();

const normalizeDailyPoints = (rewardRow, todayKey) => {
  const savedDate = rewardRow?.daily_points_date
    ? toDateKey(rewardRow.daily_points_date)
    : null;

  return savedDate === todayKey ? Number(rewardRow?.daily_points || 0) : 0;
};

const loadRewardSummary = async (seniorId) => {
  await rewardColumnsReady;

  const rewardRows = await runQuery(
    "SELECT * FROM Reward_Streak WHERE senior_id = ? ORDER BY reward_id ASC LIMIT 1",
    [seniorId]
  );
  const checkinRows = await runQuery(
    `
      SELECT checkin_timestamp, checkin_status
      FROM Daily_CheckIn
      WHERE senior_id = ?
      ORDER BY checkin_timestamp DESC
    `,
    [seniorId]
  );
  const communityRows = await runQuery(
    `
      SELECT activity_date, participation_status
      FROM Community_Hub
      WHERE senior_id = ?
      ORDER BY activity_date DESC
    `,
    [seniorId]
  );

  const rewardRow = rewardRows[0] || null;
  const todayKey = toDateKey(new Date());
  const currentStreak = calculateCurrentStreak([...checkinRows, ...communityRows]);
  const dailyPoints = normalizeDailyPoints(rewardRow, todayKey);

  if (rewardRow) {
    const needsSync =
      Number(rewardRow.current_streak || 0) !== currentStreak ||
      normalizeDailyPoints(rewardRow, todayKey) !== Number(rewardRow.daily_points || 0) ||
      toDateKey(rewardRow.daily_points_date) !== todayKey;

    if (needsSync) {
      await runQuery(
        `
          UPDATE Reward_Streak
          SET current_streak = ?, daily_points = ?, daily_points_date = ?
          WHERE reward_id = ?
        `,
        [currentStreak, dailyPoints, todayKey, rewardRow.reward_id]
      );
    }
  }

  return {
    ...(rewardRow || {}),
    senior_id: Number(seniorId),
    current_streak: currentStreak,
    total_points: Number(rewardRow?.total_points || 0),
    daily_points: dailyPoints,
    daily_points_date: todayKey,
    daily_cap: DAILY_GAME_POINT_CAP,
  };
};

// GET /rewards - all reward rows.
router.get("/", (req, res) => {
  db.query("SELECT * FROM Reward_Streak", (err, results) => {
    if (err) return res.status(500).json({ error: err.message || err });
    res.json(Array.isArray(results) ? results : []);
  });
});

// GET /rewards/senior/:senior_id - per-senior live reward summary.
router.get("/senior/:senior_id", async (req, res) => {
  try {
    const summary = await loadRewardSummary(req.params.senior_id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

// POST /rewards/senior/:senior_id/game-points - award game points with a server-side daily cap.
router.post("/senior/:senior_id/game-points", async (req, res) => {
  const seniorId = req.params.senior_id;
  const requestedPoints = Math.max(0, Number(req.body?.points || 0));

  if (!seniorId) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  try {
    const summary = await loadRewardSummary(seniorId);
    const remainingDailyPoints = Math.max(0, DAILY_GAME_POINT_CAP - Number(summary.daily_points || 0));
    const awardedPoints = Math.min(requestedPoints, remainingDailyPoints);
    const nextDailyPoints = Number(summary.daily_points || 0) + awardedPoints;
    const nextTotalPoints = Number(summary.total_points || 0) + awardedPoints;
    const todayKey = toDateKey(new Date());

    if (summary.reward_id) {
      await runQuery(
        `
          UPDATE Reward_Streak
          SET current_streak = ?, total_points = ?, daily_points = ?, daily_points_date = ?
          WHERE reward_id = ?
        `,
        [summary.current_streak, nextTotalPoints, nextDailyPoints, todayKey, summary.reward_id]
      );
    } else {
      const insertResult = await runQuery(
        `
          INSERT INTO Reward_Streak
          (senior_id, current_streak, total_points, daily_points, daily_points_date)
          VALUES (?, ?, ?, ?, ?)
        `,
        [seniorId, summary.current_streak, nextTotalPoints, nextDailyPoints, todayKey]
      );
      summary.reward_id = insertResult.insertId;
    }

    res.json({
      message: awardedPoints > 0 ? "Kopi points added." : "Daily kopi point cap reached.",
      awarded_points: awardedPoints,
      total_points: nextTotalPoints,
      daily_points: nextDailyPoints,
      daily_points_date: todayKey,
      daily_cap: DAILY_GAME_POINT_CAP,
      current_streak: summary.current_streak,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

// POST /rewards/redeem - redeem kopi and persist the deducted balance.
router.post("/redeem", async (req, res) => {
  const { senior_id, reward_name } = req.body;

  if (!senior_id || !reward_name) {
    return res.status(400).json({ error: "senior_id and reward_name are required" });
  }

  try {
    const rewardRows = await runQuery(
      "SELECT reward_id, total_points FROM Reward_Streak WHERE senior_id = ? ORDER BY reward_id ASC LIMIT 1",
      [senior_id]
    );
    const rewardRow = rewardRows[0];

    if (!rewardRow) {
      return res.status(404).json({ error: "Reward record not found." });
    }
    if (Number(rewardRow.total_points || 0) < KOPI_COST) {
      return res.status(400).json({ error: "Not enough points to redeem kopi." });
    }

    const nextTotalPoints = Number(rewardRow.total_points || 0) - KOPI_COST;

    await runQuery("UPDATE Reward_Streak SET total_points = ? WHERE reward_id = ?", [
      nextTotalPoints,
      rewardRow.reward_id,
    ]);
    await runQuery(
      `
        INSERT INTO Reward_Redemption (reward_id, reward_redeemed, redemption_date)
        VALUES (?, ?, NOW())
      `,
      [rewardRow.reward_id, reward_name]
    );

    res.json({
      message: "Reward redeemed successfully.",
      total_points: nextTotalPoints,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

module.exports = router;
