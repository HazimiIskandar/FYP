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

// ---------- Pool-based connection ----------
// Why: the previous code used mysql.createConnection -- a single physical
// connection for the whole Node process. When filess.io (managed MySQL)
// cycles idle TCP connections, that single connection gets silently
// severed and every db.query() call queues forever because its callback
// is never fired. Symptoms: routes that touch MySQL hang for 30+ seconds
// while routes that don't (e.g. the GET / warmup) respond fast.
//
// mysql2's createPool auto-reconnects on idle drops: each connection's
// lifecycle is independent, dead ones are evicted and replaced on
// demand, and a single failing connection cannot stall every route.
// The pool's `connection` event lets us run session-init SQL once per
// freshly-opened connection (here: SET time_zone='+08:00' so SGT
// timestamps stay consistent with the rest of the app's UI dates).
const pool = mysql.createPool({
  ...CONFIG,
  // Filess.io's MySQL server caps `max_user_connections` per user at 5.
  // Setting our pool's `connectionLimit` to anything >= 6 will cause
  // the 6th..Nth pool.query() acquire to be rejected by the server with
  // ER_USER_LIMIT_REACHED (errno 1226), which is exactly what blew up
  // the recent deploy. 4 leaves one slot of headroom for any external
  // MySQL client (phpMyAdmin, MySQL Workbench) the user may spin up
  // against the same DB. Bump this via `DB_POOL_LIMIT` env var on Render
  // if you migrate to a host with a higher cap.
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 1,
  waitForConnections: true,
  // Cap the queue so a misbehaving traffic spike cannot buffer thousands
  // of pending requests inside the pool. Beyond this, mysql2 returns
  // ER_CON_COUNT_ERROR to the caller immediately (route handlers log
  // it as a 500) instead of letting memory climb unbounded.
  queueLimit: Number(process.env.DB_POOL_QUEUE_LIMIT) || 50,
  enableKeepAlive: true,
  // Pick the first TCP keep-alive 30s after a connection opens -- well
  // below filess.io's idle reset interval, so the OS actively proves the
  // socket is alive before MySQL drops it.
  keepAliveInitialDelay: 30000,
});

// Set time_zone on every freshly-opened connection. mysql2's per-
// connection FIFO guarantees that any pool.query() that subsequently
// acquires this connection runs AFTER the SET time_zone callback has
// fired, so NOW() / default TIMESTAMP columns stay tagged SGT.
pool.on("connection", (conn) => {
  conn.query("SET time_zone = ?", [SINGAPORE_OFFSET], (tzErr) => {
    if (tzErr) {
      console.error(
        "[mysql] SET time_zone='+08:00' failed on new connection:",
        tzErr && tzErr.message ? tzErr.message : tzErr
      );
    }
  });
});

// Pool-level error handler. A single dead connection inside the pool
// should never crash the Node process; mysql2 will evict and replace
// it on next acquire. We log loudly so render's log feed surfaces
// silent reconnects without causing downstream outages.
pool.on("error", (err) => {
  console.warn(
    "[mysql pool] background connection error:",
    err && err.message ? err.message : err
  );
});

// Startup probe. We do NOT gate other modules on this -- routes will
// lazily create connections on demand, and they self-recover via the
// pool's reconnection machinery even if the probe fails at boot. The
// probe is purely diagnostic: a green "Connected Successfully" line
// confirms DB reachability + SGT at deploy time; a red line tells ops
// to investigate BEFORE the first user gets a 30s hang.
pool.query(
  "SELECT @@session.time_zone AS tz, NOW() AS server_now, UTC_TIMESTAMP() AS utc_now",
  (probeErr, rows) => {
    if (probeErr) {
      console.error(
        "[mysql] startup probe failed:",
        probeErr && probeErr.message ? probeErr.message : probeErr
      );
      return;
    }
    const r = (rows && rows[0]) || {};
    const tzOk = r.tz === SINGAPORE_OFFSET;
    console.log(
      "MySQL Database Connected Successfully (pool, reconnect-capable)",
      "| session.tz=" + r.tz,
      "| server_now=" + r.server_now,
      "| utc_now=" + r.utc_now,
      "| pool_limit=" + (Number(process.env.DB_POOL_LIMIT) || 4)
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

module.exports = pool;
// Re-export the connection config so other one-shot scripts (e.g.
// `_run_migration.js`) can open their OWN pool with custom options
// like `multipleStatements: true` without duplicating credentials here.
// Same CONFIG object that createPool consumed above.
module.exports.dbConfig = CONFIG;
module.exports.SINGAPORE_OFFSET = SINGAPORE_OFFSET;
