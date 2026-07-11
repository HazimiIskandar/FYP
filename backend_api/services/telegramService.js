const axios = require("axios");
const recipients = require("../telegramRecipients");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function isTelegramConfigured() {
  return Boolean(BOT_TOKEN);
}

if (!isTelegramConfigured()) {
  console.warn(
    "[telegram] TELEGRAM_BOT_TOKEN env var is missing. Telegram " +
      "check-in pings will be SKIPPED until it is set. Daily check-ins " +
      "will still work."
  );
}

async function sendTo(chatId, text) {
  try {
    const res = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      { chat_id: chatId, text, parse_mode: "HTML" },
      { timeout: 6000 }
    );
    const ok = res.data && res.data.ok;
    if (ok) {
      console.log(`[telegram] sent to chat_id=${chatId} ok`);
    } else {
      console.warn(
        `[telegram] send to ${chatId} returned ok=false:`,
        res.data
      );
    }
    return ok;
  } catch (err) {
    const detail = (err.response && err.response.data) || err.message || err;
    console.error(`[telegram] send to ${chatId} failed:`, detail);
    return false;
  }
}

// Minimal HTML escape so a senior's name with < or & doesn't break
// Telegram's HTML parse mode.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Returned whenever we couldn't notify anyone (no creds, empty bucket).
// Always has the same SHAPE — callers can safely read .aic_staff_count
// etc. without a nullability guard.
const EMPTY_COUNTS = {
  aic_staff_count: 0,
  nok_count: 0,
  caregiver_count: 0,
};

// Roles we accept in telegramRecipients.js. Mirrors the column names on
// the ServiceNow table.
const KNOWN_ROLES = new Set(["caregiver", "nok", "aic_staff"]);

function isValidEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const id = `${entry.chat_id == null ? "" : entry.chat_id}`.trim();
  const role = `${entry.role == null ? "" : entry.role}`.trim();
  return Boolean(id) && KNOWN_ROLES.has(role);
}

/**
 * Fan out the check-in ping to every chat_id in the given bucket.
 *
 * `bucket` must match a key in `telegramRecipients.js` — currently:
 *   "caregiver_aic"      → caregiver + AIC staff
 *   "caregiver_nok_aic"  → caregiver + NOK + AIC staff
 *
 * Each entry must be `{ chat_id, role }` with role in
 * {caregiver, nok, aic_staff}. Malformed entries / duplicates are dropped.
 *
 * payload = {
 *   seniorFullName:   string,
 *   eventType:        string,
 *   imOkay:           boolean,
 *   checkinTimestamp: ISO 8601 string,
 * }
 *
 * Returns an object with the COUNT of distinct chat_ids we attempted
 * to notify, per role:
 *   { aic_staff_count, nok_count, caregiver_count }
 *
 * Counts are computed BEFORE the network round-trip, so even if every
 * Telegram send later fails, the ServiceNow record still reflects
 * "we attempted to notify N people". Never throws.
 */
async function notifyCheckIn(bucket, payload) {
  if (!isTelegramConfigured()) {
    console.log(
      `[telegram] Skipping bucket="${bucket}" (TELEGRAM_BOT_TOKEN missing)`
    );
    return { ...EMPTY_COUNTS };
  }

  const raw = Array.isArray(recipients[bucket]) ? recipients[bucket] : [];

  // Drop malformed entries, dedupe by chat_id (don't double-count a
  // person who accidentally got listed twice).
  const seen = new Set();
  const valid = raw.filter((entry) => {
    if (!isValidEntry(entry)) return false;
    const key = `${entry.chat_id}`.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const counts = {
    aic_staff_count: valid.filter((e) => e.role === "aic_staff").length,
    nok_count: valid.filter((e) => e.role === "nok").length,
    caregiver_count: valid.filter((e) => e.role === "caregiver").length,
  };

  if (!valid.length) {
    console.warn(
      `[telegram] bucket="${bucket}" has no valid {chat_id, role} entries — ` +
        `skipping send (all counts 0)`
    );
    return counts;
  }

  const fullName =
    payload && payload.seniorFullName ? payload.seniorFullName : "A senior";
  const status = payload && payload.imOkay ? "OK ✅" : "Needs help ⚠️";
  const ts =
    payload && payload.checkinTimestamp
      ? payload.checkinTimestamp
      : new Date().toISOString();
  const event =
    payload && payload.eventType ? payload.eventType : "Daily Check-in";

  const text =
    `✅ <b>${escapeHtml(fullName)}</b> checked in.\n` +
    `Event: ${escapeHtml(event)}\n` +
    `Status: ${status}\n` +
    `Time: ${ts}`;

  await Promise.all(
    valid.map((entry) => sendTo(String(entry.chat_id).trim(), text))
  );

  return counts;
}

module.exports = {
  notifyCheckIn,
  isTelegramConfigured,
};
