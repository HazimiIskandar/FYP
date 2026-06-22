const express = require("express");
const router = express.Router();
const db = require("../config/db");
const {
  applyDailyPointsAward,
  calculateCurrentStreak,
  getDailyPoints,
  toDateKey,
} = require("../services/rewardService");

const DAILY_GAME_POINT_CAP = 50;

const loadRewardSummary = (seniorId, callback) => {
  const rewardSql = `SELECT * FROM Reward_Streak WHERE senior_id = ? LIMIT 1`;
  const checkinSql = `
    SELECT checkin_timestamp
    FROM Daily_CheckIn
    WHERE senior_id = ?
    ORDER BY checkin_timestamp DESC
  `;

  db.query(rewardSql, [seniorId], (rewardErr, rewardRows) => {
    if (rewardErr) return callback(rewardErr);

    db.query(checkinSql, [seniorId], (checkinErr, checkinRows) => {
      if (checkinErr) return callback(checkinErr);

      const rewardRow = rewardRows[0] || null;
      const todayKey = toDateKey(new Date());
      const actualCurrentStreak = calculateCurrentStreak(checkinRows);
      const dailyPoints = getDailyPoints(rewardRow, todayKey);

      if (rewardRow) {
        const needsSync =
          Number(rewardRow.current_streak || 0) !== actualCurrentStreak ||
          rewardRow.daily_points_date !== todayKey;

        if (needsSync) {
          db.query(
            `
              UPDATE Reward_Streak
              SET current_streak = ?, daily_points = ?, daily_points_date = ?
              WHERE senior_id = ?
            `,
            [actualCurrentStreak, dailyPoints, todayKey, seniorId],
            (updateErr) => {
              if (updateErr) {
                return callback(updateErr);
              }

              callback(null, {
                ...rewardRow,
                current_streak: actualCurrentStreak,
                daily_points: dailyPoints,
                daily_points_date: todayKey,
              });
            }
          );
          return;
        }
      }

      callback(null, {
        ...(rewardRow || {}),
        senior_id: Number(seniorId),
        current_streak: actualCurrentStreak,
        daily_points: dailyPoints,
        daily_points_date: todayKey,
      });
    });
  });
};

router.get("/", (req, res) => {
  db.query("SELECT * FROM Reward_Streak", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.get("/senior/:senior_id", (req, res) => {
  loadRewardSummary(req.params.senior_id, (err, summary) => {
    if (err) return res.status(500).json(err);
    res.json(summary || null);
  });
});

router.post("/senior/:senior_id/game-points", (req, res) => {
  const seniorId = req.params.senior_id;
  const requestedPoints = Number(req.body?.points || 0);

  if (!seniorId) {
    return res.status(400).json({ error: "senior_id is required" });
  }

  loadRewardSummary(seniorId, (err, summary) => {
    if (err) return res.status(500).json(err);

    const todayKey = toDateKey(new Date());
    const rewardRow = summary || {};
    const dailyPointsState = applyDailyPointsAward(
      rewardRow,
      todayKey,
      requestedPoints,
      DAILY_GAME_POINT_CAP
    );

    const nextTotalPoints = Number(rewardRow.total_points || 0) + dailyPointsState.awardedPoints;

    const upsertSql = rewardRow.reward_id
      ? `
          UPDATE Reward_Streak
          SET total_points = ?, daily_points = ?, daily_points_date = ?
          WHERE senior_id = ?
        `
      : `
          INSERT INTO Reward_Streak
          (senior_id, current_streak, total_points, daily_points, daily_points_date)
          VALUES (?, ?, ?, ?, ?)
        `;

    const upsertParams = rewardRow.reward_id
      ? [
          nextTotalPoints,
          dailyPointsState.nextDailyPoints,
          dailyPointsState.nextDailyPointsDate,
          seniorId,
        ]
      : [
          seniorId,
          Number(rewardRow.current_streak || 0),
          nextTotalPoints,
          dailyPointsState.nextDailyPoints,
          dailyPointsState.nextDailyPointsDate,
        ];

    db.query(upsertSql, upsertParams, (saveErr) => {
      if (saveErr) return res.status(500).json(saveErr);

      res.json({
        message:
          dailyPointsState.awardedPoints > 0
            ? "Kopi points added successfully."
            : "Daily kopi point cap reached.",
        awarded_points: dailyPointsState.awardedPoints,
        daily_points: dailyPointsState.nextDailyPoints,
        daily_points_date: dailyPointsState.nextDailyPointsDate,
        total_points: nextTotalPoints,
        current_streak: Number(rewardRow.current_streak || 0),
        daily_cap: DAILY_GAME_POINT_CAP,
      });
    });
  });
});

router.post("/redeem", (req, res) => {
  const { senior_id, reward_name } = req.body;
  if (!senior_id || !reward_name) {
    return res.status(400).json({ error: "senior_id and reward_name are required" });
  }

  const sql = `
    UPDATE Reward_Streak
    SET reward_redeemed = ?, redemption_date = NOW()
    WHERE senior_id = ?
  `;

  db.query(sql, [reward_name, senior_id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Reward redeemed successfully" });
  });
});

module.exports = router;
