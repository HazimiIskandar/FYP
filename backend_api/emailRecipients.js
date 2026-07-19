// ---------------------------------------------------------------------------------
// backend_api/emailRecipients.js
//
// Mirrors the routing role of backend_api/telegramRecipients.js — given a
// routing bucket and a senior, returns the list of recipients that should
// be notified. For email the recipient is a Gmail address looked up at
// dispatch time from MySQL User_Account.email (linked via the same
// Senior_has_Caregiver table that telegram routing transitively consumes).
//
// The current implementation resolves caregiver rows only. NOK and AIC
// staff routing can be added by extending `getEmailRecipientsForWorkflowRoute`
// with the corresponding Senior_has_NOK / Senior_has_AIC_Staff joins and
// gating inclusion on the bucket string, exactly mirroring the slot layout
// in telegramRecipients.js.
//
// Single-account setup is supported transparently: when the caregiver row's
// email equals GMAIL_USER, the SMTP faucet sends to self, just like the
// curl sanity test the developer ran.
// ---------------------------------------------------------------------------------

const db = require("./config/db");

// Wraps db.query in a Promise that resolves to [] on error so recipient
// lookup failures can never break the dispatchEngagement caller. Mirrors
// the same shape as the helper inside services/notificationFanout.js.
function dbQueryAsync(sql, params) {
  return new Promise(function (resolve) {
    db.query(sql, params, function (err, rows) {
      if (err) {
        console.warn(
          "[emailRecipients] query failed:",
          (sql || "").replace(/\s+/g, " ").trim().slice(0, 80),
          err.message
        );
        return resolve([]);
      }
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/**
 * Resolve recipient Gmail addresses for a check-in fan-out.
 *
 * @param {string} [bucket]   routing tag from notificationFanout.js
 *                            ('caregiver_aic' | 'caregiver_nok_aic' | null).
 *                            Currently unused for inclusion gating — all
 *                            linked caregivers receive the notification —
 *                            but kept in the signature so future NOK/AIC
 *                            routing can branch on it without touching
 *                            the call sites.
 * @param {number}  seniorId  Senior.senior_id
 * @returns {Promise<Array<{email: string, name: string, role: string}>>}
 */
async function getEmailRecipientsForWorkflowRoute(bucket, seniorId) {
  // Resolve caregiver rows linked to the senior via Senior_has_Caregiver
  // and join User_Account to get their email + full_name. Filter out
  // caregivers without a usable email so dispatchEngagement never tries
  // to SMTP a blank RCPT-TO.
  const rows = await dbQueryAsync(
    `SELECT ua.user_id, ua.email, ua.full_name
       FROM Senior_has_Caregiver sc
       JOIN User_Account ua ON ua.user_id = sc.caregiver_id
      WHERE sc.senior_id = ?
        AND ua.email IS NOT NULL
        AND ua.email <> ''
      ORDER BY sc.caregiver_id ASC`,
    [seniorId]
  );

  return rows
    .map(function (row) {
      return {
        email: String(row.email || "").trim(),
        name: String(row.full_name || "Caregiver").trim(),
        role: "caregiver",
      };
    })
    .filter(function (r) {
      return r.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email);
    });
}

module.exports = {
  getEmailRecipientsForWorkflowRoute,
};
