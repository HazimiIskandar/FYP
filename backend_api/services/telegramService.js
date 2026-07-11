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

/**
 * Fan out the check-in ping to every chat_id in the given bucket.
 *
 * `bucket` must match a key in `telegramRecipients.js` — currently:
 *   "caregiver_aic"      → caregiver + AIC staff
 *   "caregiver_nok_aic"  → caregiver + NOK + AIC staff
 *
 * payload = {
 *   seniorFullName:   string,
 *   eventType:        string,
 *   imOkay:           boolean,
 *   checkinTimestamp: ISO 8601 string,
 * }
 *
 * Silently skips if TELEGRAM_BOT_TOKEN isn't set. Silently skips
 * empty / duplicate ids so the recipient file can be filled in
 * gradually. Never throws.
 */
async function notifyCheckIn(bucket, payload) {
  if (!isTelegramConfigured()) {
    console.log(
      `[telegram] Skipping bucket="${bucket}" (TELEGRAM_BOT_TOKEN missing)`
    );
    return;
  }

  const chatIds = Array.isArray(recipients[bucket]) ? recipients[bucket] : [];

  // Drop empty / falsy / duplicate ids so a half-filled recipient file
  // doesn't error during development.
  const uniqueIds = Array.from(
    new Set(
      chatIds
        .map((id) => `${id == null ? "" : id}`.trim())
        .filter(Boolean)
    )
  );

  if (!uniqueIds.length) {
    console.warn(
      `[telegram] bucket="${bucket}" has no chat_ids filled in — skipping`
    );
    return;
  }

  const fullName =
    payload && payload.seniorFullName ? payload.seniorFullName : "A senior";
  const status = payload && payload.imOkay ? "OK ✅" : "Needs help ⚠️";
  const ts =
    payload && payload.checkinTimestamp
      ? payload.checkinTimestamp
      : new Date().toISOString();
  const event = payload && payload.eventType ? payload.eventType : "Daily Check-in";

  const text =
    `✅ <b>${escapeHtml(fullName)}</b> checked in.\n` +
    `Event: ${escapeHtml(event)}\n` +
    `Status: ${status}\n` +
    `Time: ${ts}`;

  await Promise.all(uniqueIds.map((id) => sendTo(id, text)));
}

module.exports = {
  notifyCheckIn,
  isTelegramConfigured,
};
