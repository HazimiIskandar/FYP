const mysql = require("mysql2");

const SINGAPORE_OFFSET = "+08:00";

// Single source of truth for DB connection: env vars override hardcoded
// defaults. createConnection consumes CONFIG directly; the runner script
// (_run_migration.js) consumes the same CONFIG via module.exports.dbConfig.
// Frozen so a caller mutating db.dbConfig.host can't poison future connects.
const CONFIG = Object.freeze({
  host: process.env.DB_HOST || "cplofo.h.filess.io",
  user: process.env.DB_USER || "senior_connect_curiousago",
  password: process.env.DB_PASSWORD || "fe9c8311734fbb029d7fec8b715366ee54ec0751",
  database: process.env.DB_NAME || "senior_connect_curiousago",
  port: Number(process.env.DB_PORT || 61032),
  // mysql2 connection option: tells the driver how to *parse* response date strings
  // (treat them as SGT when converting to JS Date). It does NOT reliably issue a
  // server-side `SET time_zone` across mysql2 versions, so we also do that explicitly
  // inside `db.connect` below. Both are needed — do not delete either.
  timezone: SINGAPORE_OFFSET,
});

const db = mysql.createConnection(CONFIG);

db.connect((err) => {
  if (err) {
    console.log("Database connection failed:", err);
    return;
  }

  // NOTE: `module.exports = db` happens synchronously below, before this callback fires.
  // Today this is safe because no route module calls `db.query(...)` at module-load
  // (queries only fire on incoming HTTP requests). If anyone ever adds a top-level
  // `db.query(...)` in a route module, gate it behind a `dbReady` flag set at the end
  // of this callback.
  db.query("SET time_zone = ?", [SINGAPORE_OFFSET], (tzErr) => {
    if (tzErr) {
      console.error("Failed to set session timezone to +08:00:", tzErr);
      return;
    }

    // Probe back the live session timezone + server time so we can visually confirm
    // SGT is applied every time the backend boots — and fail loudly if it isn't.
    db.query(
      "SELECT @@session.time_zone AS tz, NOW() AS server_now, UTC_TIMESTAMP() AS utc_now",
      (probeErr, rows) => {
        if (probeErr) {
          console.error("Timezone probe query failed:", probeErr);
          return;
        }
        const r = (rows && rows[0]) || {};
        const tzOk = r.tz === SINGAPORE_OFFSET;
        console.log(
          "MySQL Database Connected Successfully",
          "| session.tz=" + r.tz,
          "| server_now=" + r.server_now,
          "| utc_now=" + r.utc_now
        );
        if (!tzOk) {
          console.error(
            "⚠️  Expected session.tz to be +08:00 (SGT) but got",
            r.tz,
            "— timestamps will be wrong until this is fixed."
          );
        }
      }
    );
  });
});

module.exports = db;
// Re-export the connection config so other one-shot scripts (e.g.
// `_run_migration.js`) can open their OWN connection with custom options
// like `multipleStatements: true` without duplicating credentials here.
// Same CONFIG object that createConnection consumed above.
module.exports.dbConfig = CONFIG;