// ---------------------------------------------------------------------------------
// Shared engagement fan-out helper.
//
// Replaces the inline `fanOutCheckIn(...)` previously living in
// `backend_api/routes/checkInRoutes.js`. Both the I-am-okay button path AND
// the community-game activity path call `dispatchEngagement(...)` so they
// produce identical Notification audit rows + Telegram pings + ServiceNow
// `u_checkin_response` rows from a single code path.
//
// Contract:
//   - Never throws. Errors inside any sink are swallowed by
//     Promise.allSettled and logged inside the sink.
//   - The function does NOT touch src routes — call from inside
//     `setImmediate(...)` so the user's HTTP response is never blocked by
//     a Notification INSERT / Telegram POST / ServiceNow POST.
//   - Self-quiet when TELEGRAM_BOT_TOKEN / SN_OAUTH_CLIENT_ID /
//     SN_OAUTH_CLIENT_SECRET env vars are missing — each sink skips on its
//     own (see services/telegramService.js + services/servicenow.js).
// ---------------------------------------------------------------------------------

const db = require("../config/db");
const { createNotification } = require("./notificationService");
const { notifyCheckIn } = require("./telegramService");
const servicenow = require("./servicenow");

// Local helper that mirrors checkInRoutes.dbQueryAsync semantics — silently
// resolves to [] on error so enrichment failures can't break the fan-out.
function dbQueryAsync(sql, params) {
  return new Promise((resolve) => {
    db.query(sql, params, (err, rows) => {
      if (err) {
        console.warn(
          "[fanout] helper query failed:",
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
 * Dispatch a senior-engagement fan-out (Notification row + Telegram ping +
 * ServiceNow row).
 *
 * @param {Object}   args
 * @param {number}   args.checkinId       Daily_CheckIn.checkin_id (link target)
 * @param {number}   args.seniorId        Senior.senior_id
 * @param {string}   [args.bucket]        Telegram routing bucket
 *                                        ('caregiver_nok_aic' default, or
 *                                        'caregiver_aic'). Must key into
 *                                        `telegramRecipients.js`.
 * @param {number}   [args.newStreak]     Diagnostic-only streak count
 * @param {number}   [args.newTotalPoints] Diagnostic-only kopi point total
 * @param {string}   [args.eventType]     Maps to SN u_event_type choice.
 *                                        Must already be in
 *                                        servicenow.VALID_EVENT_TYPES so
 *                                        SN doesn't reject the row.
 * @param {boolean}  [args.imOkay]        Maps to SN u_im_okay bool.
 * @param {string}   [args.source]        Diagnostic-only source tag
 *                                        ('checkin' | 'community' ...).
 *                                        Goes into the log line only.
 */
async function dispatchEngagement({
  checkinId,
  seniorId,
  bucket = "caregiver_nok_aic",
  newStreak,
  newTotalPoints,
  eventType = "Daily Check-In",
  imOkay = true,
  source = "checkin",
}) {
  try {
    // Top-of-function log: if we see this in Render logs, the fan-out reached
    // dispatchEngagement AND the route scheduled us (setImmediate ticked). If
    // we DON'T see this, the gate `if (checkIn.created)` short-circuited us
    // (i.e. the senior already had a Daily_CheckIn row for today from an
    // earlier I-am-okay press) and the puzzle-fire was correctly dedup'd.
    console.log(
      "[fanout] invoked source=" + source +
        " event=" + eventType +
        " checkin_id=" + String(checkinId) +
        " senior_id=" + String(seniorId) +
        " bucket=" + bucket +
        " im_okay=" + (imOkay ? "true" : "false")
    );
    // ---------- 1. Enrich from MySQL (parallel) ----------
    const seniorRows = await dbQueryAsync(
      `SELECT ua.full_name
       FROM Senior s
       JOIN User_Account ua ON ua.user_id = s.user_id
       WHERE s.senior_id = ?
       LIMIT 1`,
      [seniorId]
    );
    const seniorName =
      (seniorRows && seniorRows[0] && seniorRows[0].full_name) || "A senior";

    const [
      caregiverRows,
      aicCountRows,
      caregiverCountRows,
      nokCountRows,
    ] = await Promise.all([
      // First caregiver name (recipient_name on the audit row).
      dbQueryAsync(
        `SELECT ua.full_name
         FROM Senior_has_Caregiver sc
         JOIN User_Account ua ON ua.user_id = sc.caregiver_id
         WHERE sc.senior_id = ?
         ORDER BY sc.caregiver_id ASC
         LIMIT 1`,
        [seniorId]
      ),
      dbQueryAsync(
        `SELECT COUNT(*) AS n FROM Senior_has_AIC_Staff WHERE senior_id = ?`,
        [seniorId]
      ),
      dbQueryAsync(
        `SELECT COUNT(*) AS n FROM Senior_has_Caregiver WHERE senior_id = ?`,
        [seniorId]
      ),
      dbQueryAsync(
        `SELECT COUNT(*) AS n FROM Senior_has_NOK WHERE senior_id = ?`,
        [seniorId]
      ),
    ]);

    const caregiverName =
      (caregiverRows && caregiverRows[0] && caregiverRows[0].full_name) ||
      "Assigned caregiver";
    const aicCount =
      (aicCountRows && aicCountRows[0] && Number(aicCountRows[0].n)) || 0;
    const caregiverCount =
      (caregiverCountRows &&
        caregiverCountRows[0] &&
        Number(caregiverCountRows[0].n)) ||
      0;
    const nokCount =
      (nokCountRows && nokCountRows[0] && Number(nokCountRows[0].n)) || 0;

    // ---------- 2. Build payloads for each sink ----------
    const checkinTimestamp = new Date().toISOString();

    const snCtx = {
      senior_id: seniorId,
      senior_full_name: seniorName,
      checkin_timestamp: checkinTimestamp,
      event_type: eventType,
      im_okay: imOkay,
      workflow_route: bucket,
      aic_staff_count: aicCount,
      caregiver_count: caregiverCount,
      nok_count: nokCount,
    };

    const tgPayload = {
      seniorFullName: seniorName,
      eventType,
      imOkay,
      checkinTimestamp,
    };

    // ---------- 3. Fire all three sinks in parallel ----------
    // createNotification is now Promise-returning (notificationService.js
    // wraps the db.query callback in a Promise, so the INSERT actually
    // settles before we proceed). notifyCheckIn and servicenow.createCheck*
    // are already thenables. We consume the per-sink settled results so a
    // future render-log dive shows EXACTLY which sink failed and why — the
    // previous version fire-and-forgot createNotification which masked
    // silent INSERT failures behind console.log only.
    //
    // When `bucket` is null (senior has no caregiver + no NOK linked) the
    // routing still flows through every sink — the SN `u_workflow_route`
    // is posted as `null` (empty in the table), the Notification audit row
    // is stamped with recipient_type="unlinked" so the failure-mode is
    // searchable in MySQL, and Telegram gracefully no-ops because
    // telegramRecipients[null] is undefined → empty chat_ids → skip.
    // This keeps the per-sink Promise.allSettled shape stable for the
    // post-sink logging below.
    const sinkResults = await Promise.allSettled([
      createNotification(
        bucket || "unlinked",
        caregiverName,
        seniorId,
        null, // event_id — community/button flows don't carry one
        checkinId
      ),
      notifyCheckIn(bucket, tgPayload),
      servicenow.createCheckInResponse(snCtx),
    ]);
    const [notifResult, tgResult, snResult] = sinkResults;

    if (notifResult.status === "fulfilled" && notifResult.value && notifResult.value.ok) {
      // success path — already logged inside createNotification
    } else {
      const reason =
        notifResult.status === "rejected"
          ? notifResult.reason
          : (notifResult.value && notifResult.value.error) || "unknown";
      console.warn(
        "[fanout] notification FAILED source=" + source +
          " checkin_id=" + String(checkinId) +
          " reason=" + (reason && reason.message ? reason.message : JSON.stringify(reason))
      );
    }
    if (tgResult.status === "rejected") {
      console.warn(
        "[fanout] telegram FAILED source=" + source +
          " reason=" + (tgResult.reason && tgResult.reason.message ? tgResult.reason.message : String(tgResult.reason))
      );
    }
    if (snResult.status === "fulfilled") {
      const wasOk =
        snResult.value && typeof snResult.value === "object" && snResult.value.sys_id;
      console.log(
        "[fanout] servicenow source=" + source +
          " result=" + (wasOk ? "OK sys_id=" + wasOk : "null")
      );
    } else {
      console.warn(
        "[fanout] servicenow FAILED source=" + source +
          " reason=" + (snResult.reason && snResult.reason.message ? snResult.reason.message : String(snResult.reason))
      );
    }

    // "dispatched" (not "completed") because Notification INSERT callback
    // runs after this log fires, and Telegram/SN return values are already
    // logged inside their own services.
    console.log(
      "[fanout] dispatched source=" +
        source +
        " event=" +
        eventType +
        " checkin_id=" +
        String(checkinId) +
        " senior_id=" +
        String(seniorId) +
        " bucket=" +
        bucket +
        " caregivers=" +
        caregiverCount +
        " noks=" +
        nokCount +
        " aic=" +
        aicCount +
        " streak=" +
        (newStreak == null ? "n/a" : String(newStreak)) +
        " total_points=" +
        (newTotalPoints == null ? "n/a" : String(newTotalPoints))
    );
  } catch (fatalErr) {
    console.warn(
      "[fanout] unexpected failure:",
      fatalErr && fatalErr.message ? fatalErr.message : String(fatalErr)
    );
  }
}

module.exports = {
  dispatchEngagement,
};
