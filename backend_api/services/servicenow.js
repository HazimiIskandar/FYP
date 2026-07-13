// ---------------------------------------------------------------------------------
// ServiceNow client — u_checkin_response (OAuth2 client_credentials)
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
//   u_event_type        Choice        (Daily Check-In | Missed Check-In | Emergency
//                                      | SOS | Fall Detected | Sensor Alert
//                                      | Community Game)
//   u_im_okay           True/False
//   u_workflow_route    Choice        (caregiver_aic | caregiver_nok_aic)
//   u_aic_staff_count   Integer       default 0
//   u_caregiver_count   Integer       default 0
//   u_nok_count         Integer       default 0
//
// Auth:
//   OAuth2 client_credentials grant against {INSTANCE_URL}/oauth_token.do. The
//   bearer token is cached in module memory and refreshed ~60s before expiry;
//   one in-flight token fetch is shared by all overlapping callers via a
//   single-flight `tokenPromise`. A 401 from /api/now invalidates the cache so
//   the next attempt recovers. HTTP Basic Auth was removed because dev316146
//   silently rejected authenticated POSTs even with confirmed-good passwords.
//
// Contract:
//   - Never throws. Returns null on failure so callers don't need try/catch.
//   - Retries once (MAX_ATTEMPTS=2) on network / token / 5xx failure.
//   - 5s request timeout per attempt to keep the event loop unblocked.
//   - Mis-shaped context values are coerced (never crash the publisher).
// ---------------------------------------------------------------------------------

const axios = require("axios");

// ----- CONFIG ------------------------------------------------------------------
const INSTANCE_URL =
  process.env.SN_INSTANCE_URL || "https://dev316146.service-now.com";
const TABLE_NAME = process.env.SN_TABLE || "u_checkin_response";

const OAUTH = {
  client_id: process.env.SN_OAUTH_CLIENT_ID,
  client_secret: process.env.SN_OAUTH_CLIENT_SECRET,
};

const REQUEST_TIMEOUT_MS = Number(process.env.SN_TIMEOUT_MS) || 5000;
const MAX_ATTEMPTS = 2;
const TOKEN_REFRESH_SAFETY_MS = 60_000; // refresh 60s before SN-issued expiry

// ----- VALIDATION CONSTANTS ----------------------------------------------------
// `Community Game` was added so the memory-match puzzle on
// `screens/CommunityScreen.js` flows through the same Notification audit +
// ServiceNow `u_checkin_response` row as the I-am-okay button. Choice
// dictionaries on the SN side may need a one-time admin update to
// accept the new value (look up u_event_type on the table's column
// schema). Invalid choices cause a 400 from /api/now — `buildPayload`
// does NOT auto-coerce once we add the value to this set; log a
// `[servicenow] FAIL status=400` if SN still rejects.
const VALID_EVENT_TYPES = new Set([
  "Daily Check-In",
  "Missed Check-In",
  "Emergency",
  "SOS",
  "Fall Detected",
  "Sensor Alert",
  "Community Game",
]);
const VALID_WORKFLOW_ROUTES = new Set([
  "caregiver_aic",
  "caregiver_nok_aic",
]);

// ----- TOKEN CACHE -------------------------------------------------------------
let cachedToken = null; // current bearer string
let tokenExpiry = 0; // epoch ms at which we treat the token as stale
let tokenPromise = null; // in-flight /oauth_token.do fetch (single-flight)

async function fetchAccessToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: OAUTH.client_id,
    client_secret: OAUTH.client_secret,
  }).toString();

  const res = await axios.post(INSTANCE_URL + "/oauth_token.do", body, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
  });

  const token =
    res && res.data && res.data.access_token
      ? String(res.data.access_token)
      : null;
  const expiresInSec =
    (res && res.data && Number(res.data.expires_in)) || 1800;
  if (!token) {
    throw new Error("/oauth_token.do returned no access_token");
  }
  cachedToken = token;
  // Schedule refresh SLIGHTLY before expiry so concurrent callers mid-flight
  // don't suddenly start seeing 401s in the gap before the next refresh.
  tokenExpiry = Date.now() + expiresInSec * 1000 - TOKEN_REFRESH_SAFETY_MS;
  return token;
}

async function getAccessToken() {
  // Cache hit if still inside the safety window.
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  // Single-flight: every caller awaiting the same token fetch shares one
  // promise. The `.finally` resets `tokenPromise` even on rejection so future
  // callers retry cleanly.
  if (tokenPromise) {
    return tokenPromise;
  }
  tokenPromise = (async () => {
    try {
      return await fetchAccessToken();
    } finally {
      tokenPromise = null;
    }
  })();
  return tokenPromise;
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
}

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

// ----- HTTP --------------------------------------------------------------------
async function attemptPost(payload, token) {
  return axios.post(INSTANCE_URL + "/api/now/table/" + TABLE_NAME, payload, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer " + token,
    },
  });
}

// ----- PUBLIC API --------------------------------------------------------------
async function createCheckInResponse(ctx) {
  try {
    const c = ctx && typeof ctx === "object" ? ctx : {};
    const seniorTag =
      c.senior_id == null || c.senior_id === "" ? "unknown" : String(c.senior_id);

    if (!OAUTH.client_id || !OAUTH.client_secret) {
      console.warn(
        "[servicenow] Skipping Senior " +
          seniorTag +
          ": SN_OAUTH_CLIENT_ID / SN_OAUTH_CLIENT_SECRET not set"
      );
      return null;
    }

    const payload = buildPayload(c);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const token = await getAccessToken();
        const response = await attemptPost(payload, token);
        const sysId =
          (response &&
            response.data &&
            response.data.result &&
            response.data.result.sys_id) ||
          "n/a";
        console.log(
          "[servicenow] OK Senior " +
            seniorTag +
            " route=" +
            payload.u_workflow_route +
            " event=" +
            payload.u_event_type +
            " sys_id=" +
            sysId +
            " attempt=" +
            attempt
        );
        return (response && response.data && response.data.result) || null;
      } catch (err) {
        const status = (err.response && err.response.status) || "no-status";
        const reason =
          (err.response &&
            err.response.data &&
            err.response.data.error &&
            err.response.data.error.message) ||
          (err.response && err.response.statusText) ||
          err.response ||
          err.code ||
          err.message ||
          "unknown error";
        console.warn(
          "[servicenow] FAIL Senior " +
            seniorTag +
            " attempt=" +
            attempt +
            "/" +
            MAX_ATTEMPTS +
            " status=" +
            status +
            " reason=" +
            JSON.stringify(reason)
        );
        // 401 from /api/now => token was rejected by SN. Force a re-fetch on
        // attempt 2. We deliberately DON'T clear on 403: a valid-token 403 is
        // an ACL/permissions failure that retrying cannot fix.
        if (status === 401) {
          clearTokenCache();
        }
        if (attempt < MAX_ATTEMPTS) continue;
      }
    }
    console.warn(
      "[servicenow] Giving up after " +
        MAX_ATTEMPTS +
        " attempts. Senior=" +
        seniorTag +
        " payload=" +
        JSON.stringify(payload)
    );
    return null;
  } catch (fatalErr) {
    console.warn(
      "[servicenow] unexpected failure: " +
        ((fatalErr && fatalErr.message) || String(fatalErr))
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
