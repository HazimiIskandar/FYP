// ---------------------------------------------------------------------------
// Backend timestamp helpers — all wall-clock values are Singapore Time (UTC+8).
//
// The MySQL session timezone is already set to +08:00 (see config/db.js), so
// NOW() / CURRENT_TIMESTAMP inside queries are SGT.  But JavaScript's
// new Date().toISOString() always emits UTC.  Use nowSgtIso() whenever a
// timestamp needs to be sent to an external system (ServiceNow, email headers,
// Telegram messages) in SGT.
// ---------------------------------------------------------------------------

const SGT_TIMEZONE = "Asia/Singapore";

/**
 * Return the current instant as an ISO-8601 string in Singapore Time (UTC+8).
 *
 * Example output: "2026-07-24T19:30:00+08:00"
 *
 * Uses Intl.DateTimeFormat for reliable component extraction across all
 * Node.js versions (no dependency on toLocaleString format quirks).
 */
function nowSgtIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SGT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => {
    const p = parts.find((part) => part.type === type);
    return p ? p.value : "00";
  };

  // en-GB with hour12:false can produce hour "24" for midnight in some
  // runtimes; clamp to "00" for a valid ISO string.
  let hour = get("hour");
  if (hour === "24") hour = "00";

  return (
    get("year") +
    "-" +
    get("month") +
    "-" +
    get("day") +
    "T" +
    hour +
    ":" +
    get("minute") +
    ":" +
    get("second") +
    "+08:00"
  );
}

/**
 * Return the current instant formatted for ServiceNow Date/Time fields.
 * Format: "yyyy-MM-dd HH:mm:ss" — no T separator, no timezone offset.
 * ServiceNow stores dates in the instance's configured timezone (SGT),
 * so the offset must be omitted to avoid double-conversion.
 *
 * Example output: "2026-07-24 19:30:00"
 */
function nowSgtDateTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SGT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => {
    const p = parts.find((part) => part.type === type);
    return p ? p.value : "00";
  };

  let hour = get("hour");
  if (hour === "24") hour = "00";

  return (
    get("year") +
    "-" +
    get("month") +
    "-" +
    get("day") +
    " " +
    hour +
    ":" +
    get("minute") +
    ":" +
    get("second")
  );
}

/**
 * Return the current instant formatted for ServiceNow Date/Time fields.
 * Format: "yyyy-MM-dd HH:mm:ss" in UTC.
 *
 * WHY UTC: ServiceNow stores all timestamps internally as UTC and
 * converts to the user's timezone for display. If we send SGT time
 * without a timezone indicator, ServiceNow misinterprets it as UTC,
 * then adds +8h on display — producing timestamps 8 hours ahead.
 * Sending actual UTC avoids this double-conversion.
 *
 * Example output: "2026-07-24 14:59:11" (when current time is 22:59 SGT)
 */
function nowUtcDateTime() {
  // toISOString() returns UTC in ISO 8601: "2026-07-24T14:59:11.000Z"
  // Slice to get "2026-07-24T14:59:11", replace T with space.
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

module.exports = { nowSgtIso, nowSgtDateTime, nowUtcDateTime, SGT_TIMEZONE };
