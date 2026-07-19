// ---------------------------------------------------------------------------------
// backend_api/scripts/seed-caregiver-email-53.js
//
// Phase 4 SQL seed: set email = 'fififi0641@gmail.com' on the caregiver row
// with user_id = 53, so dispatchEngagement's email sink finds a recipient
// when Margaret taps "I am OK" and the SMTP faucet delivers to fififi0641.
//
// Re-runnable: if the column already has fififi0641@gmail.com, the UPDATE
// reports affectedRows = 0 (still safe to run). Idempotent.
//
// Run from backend_api/:
//   node scripts/seed-caregiver-email-53.js
// ---------------------------------------------------------------------------------

const db = require("../config/db");

const TARGET_USER_ID = 53;
const TARGET_EMAIL = "fififi0641@gmail.com";

function preview(then) {
  db.query(
    "SELECT user_id, full_name, email FROM User_Account WHERE user_id = ?",
    [TARGET_USER_ID],
    function (err, rows) {
      if (err) {
        console.error("PREVIEW ERROR:", err.message);
        return process.exit(1);
      }
      console.log("--- BEFORE (user_id=" + TARGET_USER_ID + ") ---");
      console.log(JSON.stringify(rows, null, 2));
      if (!rows.length) {
        console.error("No row with user_id=" + TARGET_USER_ID + ". Aborting.");
        return process.exit(1);
      }
      then(rows[0]);
    }
  );
}

function update(currentRow, then) {
  db.query(
    "UPDATE User_Account SET email = ? WHERE user_id = ?",
    [TARGET_EMAIL, TARGET_USER_ID],
    function (err, result) {
      if (err) {
        console.error("UPDATE ERROR:", err.message);
        return process.exit(1);
      }
      console.log(
        "--- UPDATE RESULT --- affectedRows=" + result.affectedRows
      );
      if (result.affectedRows === 0 && currentRow.email === TARGET_EMAIL) {
        console.log("(already at target value — no change needed)");
      }
      verify(then);
    }
  );
}

function verify(then) {
  db.query(
    "SELECT user_id, full_name, email FROM User_Account WHERE user_id = ?",
    [TARGET_USER_ID],
    function (err, rows) {
      if (err) {
        console.error("VERIFY ERROR:", err.message);
        return process.exit(1);
      }
      console.log("--- AFTER (user_id=" + TARGET_USER_ID + ") ---");
      console.log(JSON.stringify(rows, null, 2));
      process.exit(0);
    }
  );
}

console.log(
  "[seed-caregiver-email-53] target user_id=" +
    TARGET_USER_ID +
    ", target email=" +
    TARGET_EMAIL
);
preview(function (row) {
  update(row, function () {});
});
