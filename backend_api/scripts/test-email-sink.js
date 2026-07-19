// ---------------------------------------------------------------------------------
// backend_api/scripts/test-email-sink.js
//
// One-shot diagnostic for the email notification pipeline. Bypasses the
// /checkin route + RN tap and invokes the SAME two modules that
// dispatchEngagement calls inside its email sink:
//
//   - emailRecipients.getEmailRecipientsForWorkflowRoute(bucket, seniorId)
//   - emailService.sendCheckInNotificationEmail({to, seniorName})
//
// Prints a stage-by-stage trace so we know exactly which step is breaking
// when the live tap fails to deliver an email.
//
// Run from backend_api/:
//   node scripts/test-email-sink.js
//
// IMPORTANT: if `npm start` is currently running, the backend pool is
// already using 4-5 of the MySQL user's max_user_connections. This script
// will then be the 6th and MySQL will reject it. Stop `npm start` first
// (Ctrl+C), run the script, then restart `npm start`.
// ---------------------------------------------------------------------------------

require("dotenv").config();

const db = require("../config/db");
const emailRecipients = require("../emailRecipients");
const emailService = require("../services/emailService");

function dbQueryAsync(sql, params) {
  return new Promise(function (resolve) {
    db.query(sql, params, function (err, rows) {
      if (err) return resolve({ error: err, rows: [] });
      resolve({ error: null, rows: Array.isArray(rows) ? rows : [] });
    });
  });
}

async function main() {
  console.log("=== STEP 1: list seniors in MySQL ===");
  const sr = await dbQueryAsync(
    "SELECT s.senior_id, ua.full_name " +
      "FROM Senior s " +
      "JOIN User_Account ua ON ua.user_id = s.user_id",
    []
  );
  if (sr.error) {
    console.error("DB query failed:", sr.error.message);
    return process.exit(1);
  }
  console.log("Found " + sr.rows.length + " senior(s):");
  sr.rows.forEach(function (row) {
    console.log(
      "  senior_id=" + row.senior_id + " name=" + row.full_name
    );
  });
  if (!sr.rows.length) {
    console.error("No seniors in DB. Aborting.");
    return process.exit(1);
  }
  // Auto-pick Margaret if present, else the first senior.
  const margaret =
    sr.rows.find(function (r) {
      return /margaret/i.test(r.full_name || "");
    }) || sr.rows[0];
  console.log(
    "Will use senior: senior_id=" + margaret.senior_id +
      " name=" + margaret.full_name
  );

  console.log("\n=== STEP 2: Senior_has_Caregiver linkage for this senior ===");
  const linkRows = await dbQueryAsync(
    "SELECT sc.caregiver_id, ua.email, ua.full_name " +
      "FROM Senior_has_Caregiver sc " +
      "JOIN User_Account ua ON ua.user_id = sc.caregiver_id " +
      "WHERE sc.senior_id = ?",
    [margaret.senior_id]
  );
  if (linkRows.error) {
    console.error("Linkage query failed:", linkRows.error.message);
  } else if (!linkRows.rows.length) {
    console.error(
      "*** NO CAREGIVER LINKED to this senior_id. The email sink will find zero recipients. ***"
    );
  } else {
    console.log("Linked caregivers:");
    linkRows.rows.forEach(function (r) {
      console.log(
        "  caregiver_id=" +
          r.caregiver_id +
          " email=\"" +
          (r.email || "<NULL>") +
          "\" name=" +
          r.full_name
      );
    });
  }

  console.log(
    "\n=== STEP 3: resolve via emailRecipients.js (the actual code path) ==="
  );
  const recipients = await emailRecipients.getEmailRecipientsForWorkflowRoute(
    "caregiver_nok_aic",
    margaret.senior_id
  );
  console.log("Resolved " + recipients.length + " recipient(s):");
  recipients.forEach(function (r) {
    console.log(
      "  to=" + r.email + " name=" + r.name + " role=" + r.role
    );
  });
  if (!recipients.length) {
    console.error(
      "\n*** emailRecipients returned 0. Most likely a linkage issue — Margaret is not linked " +
        "to any caregiver with a usable email. ***"
    );
    console.error(
      "Fix in two SQL statements:\n" +
        "  -- Check linkage:\n" +
        "  SELECT * FROM Senior_has_Caregiver WHERE senior_id = " +
        margaret.senior_id +
        ";\n" +
        "  -- If empty, link Margaret to user_id=53:\n" +
        "  INSERT INTO Senior_has_Caregiver (senior_id, caregiver_id) VALUES (" +
        margaret.senior_id +
        ", 53);"
    );
    return process.exit(2);
  }

  console.log("\n=== STEP 4: send test email via emailService ===");
  for (const r of recipients) {
    console.log(
      "Sending test email to: " + r.email +
        " (senior: " + margaret.full_name + ")"
    );
    const result = await emailService.sendCheckInNotificationEmail({
      to: r.email,
      seniorName: margaret.full_name,
    });
    console.log("  result: " + JSON.stringify(result));
  }
  console.log(
    "\n=== FINISHED ===\n" +
      "Check " +
      recipients[0].email +
      " Inbox + Spam within 30 s.\n" +
      "If you see 'messageId' in any result above, the SMTP send succeeded."
  );
  process.exit(0);
}

main().catch(function (err) {
  console.error(
    "FATAL:", err && err.message ? err.message : String(err)
  );
  process.exit(1);
});
