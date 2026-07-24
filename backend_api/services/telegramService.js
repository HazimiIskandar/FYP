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
async function notifyCheckIn(seniorId, payload) {
  if (!isTelegramConfigured()) {
    console.log(`[telegram] Skipping for seniorId="${seniorId}" (TELEGRAM_BOT_TOKEN missing)`);
    return;
  }

  // Fetch telegram_chat_id for all Caregivers linked to this senior
  const db = require('../config/db');
  const sql = `
    SELECT ua.telegram_chat_id 
    FROM Senior_has_Caregiver sc
    JOIN User_Account ua ON sc.caregiver_id = ua.user_id
    WHERE sc.senior_id = ? AND ua.telegram_chat_id IS NOT NULL AND TRIM(ua.telegram_chat_id) <> ''
  `;

  try {
    const rows = await new Promise((resolve, reject) => {
      db.query(sql, [seniorId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const uniqueIds = Array.from(new Set(rows.map(r => r.telegram_chat_id)));

    if (!uniqueIds.length) {
      console.warn(`[telegram] No valid telegram_chat_id found for seniorId="${seniorId}" — skipping`);
      return;
    }

    const fullName = payload && payload.seniorFullName ? payload.seniorFullName : "A senior";
    const status = payload && payload.imOkay ? "OK ✅" : "Needs help ⚠️";
    let tsRaw = payload && payload.checkinTimestamp ? payload.checkinTimestamp : new Date().toISOString();
    let ts = tsRaw;
    try {
      ts = new Date(tsRaw).toLocaleString("en-SG", { 
        timeZone: "Asia/Singapore", 
        day: "2-digit", 
        month: "short", 
        year: "numeric", 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: true 
      });
    } catch(e) {}
    const event = payload && payload.eventType ? payload.eventType : "Daily Check-in";

    const EVENT_VERBS = {
      "Daily Check-In": { emoji: "✅", verb: "checked in" },
      "Community Game": { emoji: "🎮", verb: "played a memory match puzzle" },
      "Missed Check-In": { emoji: "⚠️", verb: "missed a check-in (auto-escalated)" },
      "Missed Morning Check-In": { emoji: "⚠️", verb: "missed their morning check-in (auto-escalated)" },
      "Missed Evening Check-In": { emoji: "⚠️", verb: "missed their evening check-in (auto-escalated)" },
      "SOS": { emoji: "🚨", verb: "triggered an SOS alert" },
      "Fall Detected": { emoji: "🚑", verb: "had a fall" },
      "Sensor Alert": { emoji: "📡", verb: "had a sensor alert" },
      "Emergency": { emoji: "🚨", verb: "triggered an emergency alert" },
    };
    const eventInfo = EVENT_VERBS[event] || { emoji: "✅", verb: "checked in" };

    const text =
      eventInfo.emoji + " <b>" + escapeHtml(fullName) + "</b> " + eventInfo.verb + ".\n" +
      "Event: " + escapeHtml(event) + "\n" +
      "Status: " + status + "\n" +
      "Time: " + ts;

    await Promise.all(uniqueIds.map((id) => sendTo(id, text)));
  } catch (err) {
    console.error(`[telegram] Failed to fetch Caregiver Chat IDs for senior ${seniorId}:`, err);
  }
}

module.exports = {
  notifyCheckIn,
  isTelegramConfigured,
};
