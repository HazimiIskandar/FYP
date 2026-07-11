const axios = require("axios");

const INSTANCE_URL = "https://dev316146.service-now.com";
const TABLE_PATH = "/api/now/table/u_checkin_response";

const USERNAME = process.env.SN_USERNAME;
const PASSWORD = process.env.SN_PASSWORD;

// True when env vars are present — gates every outbound REST call so the
// backend never throws if credentials aren't wired yet. The check-in
// route still succeeds; only the SN trigger is skipped.
const isServiceNowConfigured = Boolean(USERNAME && PASSWORD);

if (!isServiceNowConfigured) {
  console.warn(
    "[servicenow] SN_USERNAME and/or SN_PASSWORD env vars are missing. " +
      "ServiceNow Flow triggers will be SKIPPED until they are set. " +
      "Daily check-ins will still work."
  );
}

const auth = {
  username: USERNAME,
  password: PASSWORD,
};

/**
 * Create a check-in record on ServiceNow. Each INSERT fires
 * the user's "Check-In Response Created" Flow.
 *
 * Field mapping (matches the user's actual `u_checkin_response` table —
 * column labels are stored WITHOUT the `u_` prefix on this table):
 *   senior_id         ← seniorId                 (Integer)
 *   senior_full_name  ← seniorFullName           (String, max 100 chars UTF-8)
 *   event_type        ← eventType                (Choice; default "Daily Check-in")
 *   workflow_route    ← workflowRoute            (Choice; default "caregiver_aic")
 *   im_okay           ← imOkay                   (True/False boolean)
 *   checkin_timestamp ← checkinTimestamp         (Date/Time ISO 8601 string)
 *   aic_staff_count   ← aic_staff_count          (Integer)
 *   caregiver_count   ← caregiver_count          (Integer)
 *   nok_count         ← nok_count                (Integer)
 *
 * Fields the workflow sets itself (NOT sent here):
 *   received_at, sys_id, Created, Updated, Created by, Updated by,
 *   Updates — all workflow-/system-managed.
 *
 * Counts reflect the Telegram fan-out we executed for this check-in
 * (via telegramService.notifyCheckIn). They're computed before sending
 * so a Telegram outage still leaves the SN record with accurate
 * "we attempted to notify N people" numbers.
 *
 * Returns the inserted SN record on success, or null when ServiceNow is
 * not configured / call fails. Never throws — callers can rely on this
 * being best-effort.
 */
// `senior_full_name` is a String with max length 100 per the SN column
// definition. Anything longer gets rejected by SN — defend against it by
// truncating defensively before sending.
function trimToColumnLength(value, maxLength) {
  return String(value == null ? "" : value).slice(0, maxLength);
}

async function createCheckInResponse({
  seniorId,
  seniorFullName,
  eventType,
  workflowRoute,
  imOkay,
  checkinTimestamp,
  aic_staff_count = 0,
  caregiver_count = 0,
  nok_count = 0,
}) {
  if (!isServiceNowConfigured) {
    console.log(
      "[servicenow] Skipping trigger (creds missing) for senior_id=" + seniorId
    );
    return null;
  }

  const payload = {
    senior_id: seniorId,
    senior_full_name: trimToColumnLength(seniorFullName, 100),
    event_type: eventType,
    workflow_route: workflowRoute,
    im_okay: imOkay,
    checkin_timestamp: checkinTimestamp,
    aic_staff_count: Number(aic_staff_count) || 0,
    caregiver_count: Number(caregiver_count) || 0,
    nok_count: Number(nok_count) || 0,
  };

  try {
    const response = await axios.post(
      `${INSTANCE_URL}${TABLE_PATH}`,
      payload,
      {
        auth,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        // Keep SN failures snappy so /checkin doesn't hang on the user
        // if ServiceNow is slow / unreachable.
        timeout: 6000,
      }
    );

    const result = response.data && response.data.result;
    console.log(
      "[servicenow] u_checkin_response created sys_id=" +
        (result && result.sys_id)
    );
    return result || null;
  } catch (error) {
    const status = error.response && error.response.status;
    const detail =
      (error.response && error.response.data) || error.message || error;
    console.error(
      `[servicenow] POST ${TABLE_PATH} failed (status=${status || "n/a"}):`,
      detail
    );
    return null;
  }
}

/**
 * Trigger the senior's check-in workflow in ServiceNow.
 * Defaults match the existing Flow:
 *  - eventType "Daily Check-in" hits the user's first IF branch
 *  - workflowRoute "caregiver_aic" lines up with telegramRecipients.js
 */
async function triggerCheckIn({
  seniorId,
  seniorFullName,
  imOkay = true,
  eventType = "Daily Check-in",
  workflowRoute = "caregiver_aic",
  checkinTimestamp = new Date().toISOString(),
  aic_staff_count = 0,
  caregiver_count = 0,
  nok_count = 0,
}) {
  return await createCheckInResponse({
    seniorId,
    seniorFullName,
    eventType,
    workflowRoute,
    imOkay,
    checkinTimestamp,
    aic_staff_count,
    caregiver_count,
    nok_count,
  });
}

module.exports = {
  triggerCheckIn,
  createCheckInResponse,
  isServiceNowConfigured,
};
