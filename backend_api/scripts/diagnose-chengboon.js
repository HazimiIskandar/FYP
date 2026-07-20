// ---------------------------------------------------------------------------------
// backend_api/scripts/diagnose-chengboon.js
//
// One-shot diagnostic specific to "why does Cheng Boon tap not deliver email?".
// Prints 6 self-contained steps, ends with one real SMTP send so we get
// observable evidence in the caregiver's Inbox/Spam.
//
// Will create at most one extra SMTP send per run. Re-running sends more.
// ---------------------------------------------------------------------------------

require("dotenv").config();

const db = require("../config/db");
const emailRecipients = require("../emailRecipients");
const emailService = require("../services/emailService");

function dbQueryAsync(sql, params) {
  return new Promise((resolve) => {
    db.query(sql, params, (err, rows) => {
      if (err) {
        console.error("[q-err]", err.message);
        return resolve([]);
      }
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

async function main() {
  console.log("=== STEP A: Cheng Boon linkage (senior_id=3) ===");
  const linkRes = await dbQueryAsync(
    "SELECT sc.senior_id, sc.caregiver_id, ua.full_name AS caregiver_name, ua.email " +
      "FROM Senior_has_Caregiver sc " +
      "JOIN User_Account ua ON ua.user_id = sc.caregiver_id " +
      "WHERE sc.senior_id = 3 ORDER BY sc.caregiver_id",
    []
  );
  console.log(JSON.stringify(linkRes, null, 2));

  console.log("\n=== STEP B: user_id=53 current state (email column) ===");
  const u53 = await dbQueryAsync(
    "SELECT user_id, full_name, email FROM User_Account WHERE user_id = 53",
    []
  );
  console.log(JSON.stringify(u53, null, 2));

  console.log("\n=== STEP C: every linkage row in Senior_has_Caregiver ===");
  const allLink = await dbQueryAsync(
    "SELECT sc.id, sc.senior_id, sc.caregiver_id, ua.full_name AS caregiver_name, ua.email " +
      "FROM Senior_has_Caregiver sc " +
      "JOIN User_Account ua ON ua.user_id = sc.caregiver_id " +
      "ORDER BY sc.senior_id, sc.caregiver_id",
    []
  );
  console.log(JSON.stringify(allLink, null, 2));

  console.log(
    "\n=== STEP D: resolve recipients for senior_id=3 via emailRecipients.getEmailRecipientsForWorkflowRoute(null, 3) ==="
  );
  const recipients = await emailRecipients.getEmailRecipientsForWorkflowRoute(
    null,
    3
  );
  console.log(JSON.stringify(recipients, null, 2));

  console.log(
    "\n=== STEP E: live SMTP send to each Cheng Boon recipient (seniorName='Su Cheng Boon') ==="
  );
  if (!recipients.length) {
    console.log("  (no recipients — diagnostic ends here)");
  } else {
    for (const r of recipients) {
      const result = await emailService.sendCheckInNotificationEmail({
        to: r.email,
        seniorName: "Su Cheng Boon",
      });
      console.log("  to=" + r.email + " -> " + JSON.stringify(result));
    }
  }

  console.log("\n=== STEP F: env state ===");
  console.log(
    "GMAIL_USER=" + (process.env.GMAIL_USER || "(unset)")
  );
  console.log(
    "GMAIL_APP_PASSWORD=" +
      (process.env.GMAIL_APP_PASSWORD
        ? "<set, " + process.env.GMAIL_APP_PASSWORD.length + " chars>"
        : "(unset)")
  );

  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
