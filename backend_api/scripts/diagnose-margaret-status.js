require("dotenv").config();

const db = require("../config/db");

function q(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => {
      if (err) return reject(err);
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

async function main() {
  const seniors = await q(
    "SELECT s.senior_id, s.user_id, ua.full_name " +
      "FROM Senior s JOIN User_Account ua ON ua.user_id = s.user_id " +
      "WHERE ua.full_name LIKE ? ORDER BY s.senior_id ASC",
    ["%Margaret%"]
  );

  console.log("Matched seniors:", JSON.stringify(seniors, null, 2));

  if (!seniors.length) {
    console.log("No Margaret rows found.");
    return;
  }

  for (const senior of seniors) {
    const sid = senior.senior_id;

    const latestCheckins = await q(
      "SELECT checkin_id, senior_id, checkin_status, checkin_timestamp " +
        "FROM Daily_CheckIn WHERE senior_id = ? ORDER BY checkin_timestamp DESC LIMIT 20",
      [sid]
    );

    const todayCheckins = await q(
      "SELECT checkin_id, senior_id, checkin_status, checkin_timestamp, " +
        "DATE(checkin_timestamp) AS checkin_date, HOUR(checkin_timestamp) AS checkin_hour " +
        "FROM Daily_CheckIn " +
        "WHERE senior_id = ? AND DATE(checkin_timestamp) = CURDATE() " +
        "ORDER BY checkin_timestamp DESC",
      [sid]
    );

    const events = await q(
      "SELECT event_id, senior_id, event_type, event_status, escalation_level, created_at " +
        "FROM Emergency_Event WHERE senior_id = ? ORDER BY created_at DESC LIMIT 20",
      [sid]
    );

    const openEvents = events.filter((e) => {
      const status = String(e.event_status || "").toLowerCase();
      return status !== "resolved" && status !== "closed" && status !== "cancelled";
    });

    console.log("\n=== Senior ===");
    console.log(JSON.stringify(senior, null, 2));

    console.log("Latest check-ins:");
    console.log(JSON.stringify(latestCheckins, null, 2));

    console.log("Today check-ins (CURDATE in DB session timezone):");
    console.log(JSON.stringify(todayCheckins, null, 2));

    console.log("Open events:");
    console.log(JSON.stringify(openEvents, null, 2));
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err && err.message ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => {
    db.end();
  });
