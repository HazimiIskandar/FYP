// ---------------------------------------------------------------------------------
// backend_api/scripts/condense-margaret-caregivers-to-53.js
//
// One-shot fix script. The user wants the live-tap email to land EXACTLY in
// fififi0641@gmail.com — no Amanda Lee, no Leficgg. So this:
//
//   1. Verifies user_id=53 still has email = 'fififi0641@gmail.com'
//   2. Lists existing Senior_has_Caregiver rows for Margaret (senior_id=1)
//   3. Deletes every existing caregiver link for Margaret
//   4. Re-inserts a single new row linking Margaret → user_id=53
//   5. Verifies the post-state and prints the resulting linkage
//
// Idempotent: re-running this script on the post-state produces the same
// post-state (one DELETE removes the existing user_id=53 link, then the
// INSERT puts it back). Safe to run.
//
// IMPORTANT: like other scripts that go through backend_api/config/db.js,
// this uses the shared MySQL connection pool. If `npm start` is holding
// all 5 max_user_connections, this script will fail. Stop npm start first
// or clear the connection cap server-side.
// ---------------------------------------------------------------------------------

require("dotenv").config();
const db = require("../config/db");

const MARGARET_ID = 1;
const TARGET_CAREGIVER_ID = 53;
const TARGET_EMAIL = "fififi0641@gmail.com";

function dbQueryAsync(sql, params) {
  return new Promise(function (resolve) {
    db.query(sql, params, function (err, rows) {
      if (err) return resolve({ error: err, rows: [], result: null });
      resolve({ error: null, rows: Array.isArray(rows) ? rows : [], result: rows });
    });
  });
}

async function run() {
  console.log(
    "=== STEP A: verify user_id=" + TARGET_CAREGIVER_ID +
      " has email=" + TARGET_EMAIL + " ==="
  );
  const userRow = await dbQueryAsync(
    "SELECT user_id, full_name, email FROM User_Account WHERE user_id = ?",
    [TARGET_CAREGIVER_ID]
  );
  if (userRow.error) {
    console.error("DB error:", userRow.error.message);
    return process.exit(1);
  }
  if (!userRow.rows.length) {
    console.error("*** No row with user_id=" + TARGET_CAREGIVER_ID + ". ***");
    return process.exit(1);
  }
  const u = userRow.rows[0];
  console.log(
    "  user_id=" + u.user_id + " name=" + u.full_name +
      " email=" + (u.email || "<NULL>")
  );
  if (String(u.email || "").trim() !== TARGET_EMAIL) {
    console.error(
      "*** email is not '" + TARGET_EMAIL + "'. Re-seed user_id=" +
        TARGET_CAREGIVER_ID + " first with the seed-caregiver-email-53.js script. ***"
    );
    return process.exit(1);
  }

  console.log(
    "\n=== STEP B: list current Senior_has_Caregiver for senior_id=" +
      MARGARET_ID + " (Margaret) ==="
  );
  const before = await dbQueryAsync(
    "SELECT sc.caregiver_id, ua.full_name, ua.email " +
      "FROM Senior_has_Caregiver sc " +
      "JOIN User_Account ua ON ua.user_id = sc.caregiver_id " +
      "WHERE sc.senior_id = ?",
    [MARGARET_ID]
  );
  if (before.error) {
    console.error("SELECT failed:", before.error.message);
    return process.exit(1);
  }
  if (!before.rows.length) {
    console.log("  (none — Margaret has no caregivers currently)");
  } else {
    before.rows.forEach(function (r) {
      console.log(
        "  caregiver_id=" + r.caregiver_id +
          " name=" + r.full_name +
          " email=" + r.email
      );
    });
  }

  console.log(
    "\n=== STEP C: DELETE every existing caregiver link for senior_id=" +
      MARGARET_ID + " ==="
  );
  const del = await dbQueryAsync(
    "DELETE FROM Senior_has_Caregiver WHERE senior_id = ?",
    [MARGARET_ID]
  );
  if (del.error) {
    console.error("DELETE failed:", del.error.message);
    return process.exit(1);
  }
  const delCount = del.result && del.result.affectedRows !== undefined
    ? del.result.affectedRows
    : "?";
  console.log("  deleted " + delCount + " row(s)");

  console.log(
    "\n=== STEP D: INSERT Margaret (1) → caregiver user_id=" +
      TARGET_CAREGIVER_ID + " ==="
  );
  const ins = await dbQueryAsync(
    "INSERT INTO Senior_has_Caregiver (senior_id, caregiver_id) VALUES (?, ?)",
    [MARGARET_ID, TARGET_CAREGIVER_ID]
  );
  if (ins.error) {
    console.error("INSERT failed:", ins.error.message);
    return process.exit(1);
  }
  console.log("  inserted 1 row");

  console.log(
    "\n=== STEP E: verify post-state linkage for senior_id=" + MARGARET_ID + " ==="
  );
  const after = await dbQueryAsync(
    "SELECT sc.caregiver_id, ua.full_name, ua.email " +
      "FROM Senior_has_Caregiver sc " +
      "JOIN User_Account ua ON ua.user_id = sc.caregiver_id " +
      "WHERE sc.senior_id = ?",
    [MARGARET_ID]
  );
  if (after.error) {
    console.error("SELECT failed:", after.error.message);
    return process.exit(1);
  }
  if (!after.rows.length) {
    console.error("*** Post-state has no caregivers. ***");
    return process.exit(2);
  }
  after.rows.forEach(function (r) {
    console.log(
      "  caregiver_id=" + r.caregiver_id +
        " name=" + r.full_name +
        " email=" + r.email
    );
  });

  if (
    after.rows.length !== 1 ||
    after.rows[0].caregiver_id !== TARGET_CAREGIVER_ID
  ) {
    console.error(
      "\n*** Post-state is wrong: expected exactly 1 row with caregiver_id=" +
        TARGET_CAREGIVER_ID + ". ***"
    );
    return process.exit(2);
  }

  console.log(
    "\n=== DONE ===\n" +
      "Margaret now has exactly 1 caregiver: user_id=" +
      TARGET_CAREGIVER_ID +
      " (email=" +
      TARGET_EMAIL +
      ").\n" +
      "Live tap will send ONE email to " + TARGET_EMAIL + "."
  );
  process.exit(0);
}

run().catch(function (err) {
  console.error("FATAL:", err && err.message ? err.message : String(err));
  process.exit(1);
});
