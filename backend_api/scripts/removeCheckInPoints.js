const db = require("../config/db");

const CHECK_IN_POINTS_TO_REMOVE = 10;

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

const main = async () => {
  const rows = await runQuery(
    `
      SELECT
        rs.reward_id,
        rs.senior_id,
        rs.total_points,
        COUNT(dc.checkin_id) AS completed_checkins,
        LEAST(rs.total_points, COUNT(dc.checkin_id) * ?) AS points_to_remove,
        GREATEST(rs.total_points - (COUNT(dc.checkin_id) * ?), 0) AS corrected_total_points
      FROM Reward_Streak rs
      LEFT JOIN Daily_CheckIn dc
        ON dc.senior_id = rs.senior_id
        AND LOWER(dc.checkin_status) LIKE '%completed%'
      GROUP BY rs.reward_id, rs.senior_id, rs.total_points
      HAVING completed_checkins > 0
      ORDER BY rs.senior_id ASC
    `,
    [CHECK_IN_POINTS_TO_REMOVE, CHECK_IN_POINTS_TO_REMOVE]
  );

  if (!rows.length) {
    console.log("No completed Daily_CheckIn rows found. No point correction needed.");
    return;
  }

  console.table(
    rows.map((row) => ({
      senior_id: row.senior_id,
      current_total_points: row.total_points,
      completed_checkins: row.completed_checkins,
      points_to_remove: row.points_to_remove,
      corrected_total_points: row.corrected_total_points,
    }))
  );

  await runQuery(
    `
      UPDATE Reward_Streak rs
      JOIN (
        SELECT
          senior_id,
          COUNT(checkin_id) AS completed_checkins
        FROM Daily_CheckIn
        WHERE LOWER(checkin_status) LIKE '%completed%'
        GROUP BY senior_id
      ) dc
        ON dc.senior_id = rs.senior_id
      SET rs.total_points = GREATEST(rs.total_points - (dc.completed_checkins * ?), 0)
    `,
    [CHECK_IN_POINTS_TO_REMOVE]
  );

  console.log("Removed historical Daily_CheckIn point awards from Reward_Streak.");
};

main()
  .catch((err) => {
    console.error("Failed to remove Daily_CheckIn points:", err.message || err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.end();
  });
