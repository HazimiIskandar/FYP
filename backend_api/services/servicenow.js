// ---------------------------------------------------------------------------------
// ServiceNow client — u_checkin_response
//
// Purpose:
//   Fire-and-forget POST of an enriched Daily_CheckIn payload to the personal
//   ServiceNow table `u_checkin_response`, so a Flow Designer "Record Created"
//   trigger can run the Check-In Response Workflow.
//
// Table columns (from ServiceNow "Table - Check-In Response"):
//   u_senior_id         String        (<=50)
//   u_senior_full_name  String (UTF-8)
//   u_checkin_timestamp Date/Time
//   u_received_at       Date/Time
//   u_event_type        Choice        (Daily Check-In | Missed Check-In | Emergency)
//   u_im_okay           True/False
//   u_workflow_route    Choice        (caregiver_aic | caregiver_nok_aic)
//   u_aic_staff_count   Integer       default 0
//   u_caregiver_count   Integer       default 0
//   u_nok_count         Integer       default 0
//
// Contract:
//   - Never throws. Returns null on failure so callers don't need try/catch.
//   - Retries once (MAX_ATTEMPTS=2) on network / auth / 5xx failure.
//   - 5s request timeout per attempt to keep the event loop unblocked.
//   - Mis-shaped context values are coerced (never crash the publisher).
// ---------------------------------------------------------------------------------

const axios = require("axios");

// ----- CONFIG ------------------------------------------------------------------
const INSTANCE_URL =
  process.env.SN_INSTANCE_URL || "https://dev316146.service-now.com";
const TABLE_NAME = process.env.SN_TABLE || "u_checkin_response";

const AUTH = {
  username: process.env.SN_USERNAME,
  password: process.env.SN_PASSWORD,
};

const REQUEST_TIMEOUT_MS = Number(process.env.SN_TIMEOUT_MS) || 5000;
const MAX_ATTEMPTS = 2;

const VALID_EVENT_TYPES = new Set([
  "Daily Check-In",
  "Missed Check-In",
  "Emergency",
]);
const VALID_WORKFLOW_ROUTES = new Set([
  "caregiver_aic",
  "caregiver_nok_aic",
]);

// ----- HELPERS -----------------------------------------------------------------
function coerceInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceBool(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function coerceDateTime(value) {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  return String(value);
}

function buildPayload(ctx) {
  const c = ctx && typeof ctx === "object" ? ctx : {};
  const route = VALID_WORKFLOW_ROUTES.has(c.workflow_route)
    ? c.workflow_route
    : "caregiver_aic";
  const eventType = VALID_EVENT_TYPES.has(c.event_type)
    ? c.event_type
    : "Daily Check-In";

  return {
    u_senior_id:
      c.senior_id == null || c.senior_id === "" ? null : String(c.senior_id),
    u_senior_full_name: c.senior_full_name ?? null,
    u_checkin_timestamp: coerceDateTime(c.checkin_timestamp),
    u_received_at: coerceDateTime(c.received_at) || new Date().toISOString(),
    u_event_type: eventType,
    u_im_okay: coerceBool(c.im_okay, true),
    u_workflow_route: route,
    u_aic_staff_count: coerceInt(c.aic_staff_count, 0),
    u_caregiver_count: coerceInt(c.caregiver_count, 0),
    u_nok_count: coerceInt(c.nok_count, 0),
  };
}

async function attemptPost(payload) {
  return axios.post(INSTANCE_URL + "/api/now/table/" + TABLE_NAME, payload, {
    auth: AUTH,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

// ----- PUBLIC API --------------------------------------------------------------
async function createCheckInResponse(ctx) {
  try {
    const c = ctx && typeof ctx === "object" ? ctx : {};
    const seniorTag =
      c.senior_id == null || c.senior_id === "" ? "unknown" : String(c.senior_id);

    if (!AUTH.username || !AUTH.password) {
      console.warn(
        "[servicenow] Skipping Senior " + seniorTag + ": SN_USERNAME / SN_PASSWORD not set"
      );
      return null;
    }

    const payload = buildPayload(c);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await attemptPost(payload);
        const sysId = response && response.data && response.data.result && response.data.result.sys_id || "n/a";
        console.log(
          "[servicenow] OK Senior " + seniorTag + " route=" + payload.u_workflow_route + " event=" + payload.u_event_type + " sys_id=" + sysId + " attempt=" + attempt
        );
        return response && response.data && response.data.result || null;
      } catch (err) {
        const reason =
          (err.response && err.response.data && err.response.data.error && err.response.data.error.message) ||
          err.response || err.response && err.response.statusText ||
          err.code || err.message || "unknown error";
        const status = (err.response && err.response.status) || "no-status";
        console.warn(
          "[servicenow] FAIL Senior " + seniorTag + " attempt=" + attempt + "/" + MAX_ATTEMPTS + " status=" + status + " reason=" + JSON.stringify(reason)
        );
        if (attempt < MAX_ATTEMPTS) continue;
      }
    }
    console.warn(
      "[servicenow] Giving up after " + MAX_ATTEMPTS + " attempts. Senior=" + seniorTag + " payload=" + JSON.stringify(payload)
    );
    return null;
  } catch (fatalErr) {
    console.warn(
      "[servicenow] unexpected failure: " + ((fatalErr && fatalErr.message) || String(fatalErr))
    );
    return null;
  }
}

async function triggerCheckIn(seniorId, eventType, isOkay) {
  return createCheckInResponse({
    senior_id: seniorId,
    event_type: eventType,
    im_okay: isOkay,
  });
}

module.exports = {
  createCheckInResponse,
  triggerCheckIn,
  buildPayload,
};
