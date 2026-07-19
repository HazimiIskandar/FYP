// ---------------------------------------------------------------------------------
// backend_api/scripts/link-senior-to-caregiver.js
//
// Reusable CLI: manage Senior_has_Caregiver rows so a senior's "I am OK"
// tap delivers the check-in email to the right caregiver's Gmail inbox.
//
// Usage:
//   node link-senior-to-caregiver.js                    # default: add 3 53
//                                                       # (Su Cheng Boon → user_id=53)
//   node link-senior-to-caregiver.js add <s> <c>        # link seniorId=cId
//   node link-senior-to-caregiver.js remove <s> <c>     # unlink
//   node link-senior-to-caregiver.js list               # all linkages
//   node link-senior-to-caregiver.js show-seniors       # list all senior_id+name
//   node link-senior-to-caregiver.js show-caregivers    # list all caregiver user_id+email
//   node link-senior-to-caregiver.js help
//
// Why this script exists: the check-in email pipeline (notificationFanout.js
// → emailRecipients.js → emailService.js) only sends when a row exists in
// Senior_has_Caregiver linking the senior to a caregiver with a populated
// User_Account.email. This script is the data-side operation that lets you
// shape which taps email which caregiver.
//
// IMPORTANT: uses backend_api/config/db.js pool. If `npm start` is running
// AND max_user_connections=5 is hit, this script will fail. Stop npm start
// first or clear the connection cap server-side.
// ---------------------------------------------------------------------------------

require("dotenv").config();
const db = require("../config/db");

function dbQueryAsync(sql, params) {
  return new Promise(function (resolve) {
    db.query(sql, params, function (err, rows) {
      if (err) return resolve({ error: err, rows: [], result: null });
      resolve({
        error: null,
        rows: Array.isArray(rows) ? rows : [],
        result: rows,
      });
    });
  });
}

function printHelp() {
  console.log(
    "Commands:\n" +
      "  add <seniorId> <caregiverId>        INSERT \"(seniorId, caregiverId)\" pair\n" +
      "  remove <seniorId> <caregiverId>     DELETE that pair\n" +
      "  list                                Print all current linkages\n" +
      "  show-seniors                        Print all senior_id + name pairs\n" +
      "  show-caregivers                     Print all caregiver user_id + email\n" +
      "  help                                This text\n" +
      "\nDefault (no args) = add 3 53 (Su Cheng Boon → user_id=53 with email fififi0641@gmail.com)."
  );
}

async function add(seniorId, caregiverId) {
  console.log(
    "=== ADD: linking senior(" + seniorId + ") → caregiver(" + caregiverId + ") ==="
  );

  const s = await dbQueryAsync(
    "SELECT s.senior_id, ua.full_name " +
      "FROM Senior s " +
      "JOIN User_Account ua ON ua.user_id = s.user_id " +
      "WHERE s.senior_id = ?",
    [seniorId]
  );
  if (s.error) {
    console.error("DB error (senior lookup):", s.error.message);
    return process.exit(1);
  }
  if (!s.rows.length) {
    console.error("*** Senior " + seniorId + " does not exist. ***");
    return process.exit(1);
  }
  console.log("  Senior found: senior_id=" + s.rows[0].senior_id + " · " + s.rows[0].full_name);

  const c = await dbQueryAsync(
    "SELECT user_id, full_name, email FROM User_Account WHERE user_id = ?",
    [caregiverId]
  );
  if (c.error) {
    console.error("DB error (caregiver lookup):", c.error.message);
    return process.exit(1);
  }
  if (!c.rows.length) {
    console.error(
      "*** Caregiver user_id=" + caregiverId + " does not exist. ***"
    );
    return process.exit(1);
  }
  console.log(
    "  Caregiver found: user_id=" + c.rows[0].user_id +
      " · " + c.rows[0].full_name +
      " · email=" + (c.rows[0].email || "<NULL>")
  );
  if (!c.rows[0].email) {
    console.error(
      "*** Caregiver's email is NULL or empty. Run seed-caregiver-email-53.js first. ***"
    );
    return process.exit(1);
  }

  // Pre-check (idempotent)
  const existing = await dbQueryAsync(
    "SELECT * FROM Senior_has_Caregiver WHERE senior_id = ? AND caregiver_id = ?",
    [seniorId, caregiverId]
  );
  if (existing.error) {
    console.error("DB error (linkage check):", existing.error.message);
    return process.exit(1);
  }
  if (existing.rows.length) {
    console.log("  (already linked — no change needed)");
    return process.exit(0);
  }

  const r = await dbQueryAsync(
    "INSERT INTO Senior_has_Caregiver (senior_id, caregiver_id) VALUES (?, ?)",
    [seniorId, caregiverId]
  );
  if (r.error) {
    console.error("INSERT failed:", r.error.message);
    return process.exit(1);
  }
  console.log(
    "  ✓ Linked senior(" + seniorId + ") → caregiver(" + caregiverId + ")"
  );
  console.log(
    "  ✓ Tapping \"I am OK\" on senior(" + seniorId + ") now delivers email to " +
      c.rows[0].email
  );
  process.exit(0);
}

async function remove(seniorId, caregiverId) {
  console.log(
    "=== REMOVE: unlinking senior(" + seniorId + ") ← caregiver(" + caregiverId + ") ==="
  );
  const r = await dbQueryAsync(
    "DELETE FROM Senior_has_Caregiver WHERE senior_id = ? AND caregiver_id = ?",
    [seniorId, caregiverId]
  );
  if (r.error) {
    console.error("DELETE failed:", r.error.message);
    return process.exit(1);
  }
  const count = r.result && r.result.affectedRows;
  console.log("  Deleted " + count + " row(s).");
  process.exit(0);
}

async function list() {
  console.log("=== LIST: every current Senior_has_Caregiver linkage ===");
  const r = await dbQueryAsync(
    "SELECT sc.senior_id, ua_s.full_name AS senior_name, " +
      "sc.caregiver_id, ua_c.full_name AS caregiver_name, ua_c.email " +
      "FROM Senior_has_Caregiver sc " +
      "JOIN Senior s ON s.senior_id = sc.senior_id " +
      "JOIN User_Account ua_s ON ua_s.user_id = s.user_id " +
      "JOIN User_Account ua_c ON ua_c.user_id = sc.caregiver_id " +
      "ORDER BY sc.senior_id, sc.caregiver_id"
  );
  if (r.error) {
    console.error("DB error:", r.error.message);
    return process.exit(1);
  }
  if (!r.rows.length) {
    console.log("  (none — no linkages currently)");
  } else {
    console.log("  senior_id | senior_name        | caregiver_id | caregiver_name | email");
    console.log("  ----------+--------------------+--------------+----------------+----------------");
    r.rows.forEach(function (row) {
      console.log(
        "  " +
          String(row.senior_id).padEnd(9) +
          " | " +
          String(row.senior_name || "").padEnd(18) +
          " | " +
          String(row.caregiver_id).padEnd(12) +
          " | " +
          String(row.caregiver_name || "").padEnd(14) +
          " | " +
          (row.email || "<NULL>")
      );
    });
  }
  process.exit(0);
}

async function showSeniors() {
  console.log("=== SHOW-SENIORS: every senior in the database ===");
  const r = await dbQueryAsync(
    "SELECT s.senior_id, ua.full_name " +
      "FROM Senior s " +
      "JOIN User_Account ua ON ua.user_id = s.user_id " +
      "ORDER BY s.senior_id"
  );
  if (r.error) {
    console.error("DB error:", r.error.message);
    return process.exit(1);
  }
  r.rows.forEach(function (row) {
    console.log("  senior_id=" + row.senior_id + " · " + row.full_name);
  });
  process.exit(0);
}

async function showCaregivers() {
  console.log("=== SHOW-CAREGIVERS: every caregiver in the database ===");
  const r = await dbQueryAsync(
    "SELECT user_id, full_name, email " +
      "FROM User_Account " +
      "WHERE role_id = 2 OR role = 'Caregiver' " +
      "ORDER BY user_id"
  );
  if (r.error) {
    console.error("DB error:", r.error.message);
    return process.exit(1);
  }
  r.rows.forEach(function (row) {
    console.log(
      "  user_id=" +
        row.user_id +
        " · " +
        row.full_name +
        " · email=" +
        (row.email || "<NULL>")
    );
  });
  process.exit(0);
}

(async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    return add(3, 53);
  }
  const cmd = args[0];
  if (cmd === "add") {
    if (args.length < 3) {
      console.error("add requires <seniorId> <caregiverId>");
      printHelp();
      return process.exit(1);
    }
    const s = parseInt(args[1], 10);
    const c = parseInt(args[2], 10);
    if (!Number.isFinite(s) || !Number.isFinite(c)) {
      console.error("seniorId and caregiverId must be integers");
      return process.exit(1);
    }
    return add(s, c);
  }
  if (cmd === "remove") {
    if (args.length < 3) {
      console.error("remove requires <seniorId> <caregiverId>");
      printHelp();
      return process.exit(1);
    }
    const s = parseInt(args[1], 10);
    const c = parseInt(args[2], 10);
    if (!Number.isFinite(s) || !Number.isFinite(c)) {
      console.error("seniorId and caregiverId must be integers");
      return process.exit(1);
    }
    return remove(s, c);
  }
  if (cmd === "list") return list();
  if (cmd === "show-seniors") return showSeniors();
  if (cmd === "show-caregivers") return showCaregivers();
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return process.exit(0);
  }
  console.error("Unknown command: " + cmd);
  printHelp();
  return process.exit(1);
})().catch(function (err) {
  console.error("FATAL:", err && err.message ? err.message : String(err));
  process.exit(1);
});
