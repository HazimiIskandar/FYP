// Map of routing bucket → array of role-tagged Telegram recipients.
//
// Each entry is an object: { chat_id, role }
//   chat_id : numeric ID from @userinfobot (kept as a string)
//   role    : one of "caregiver" | "nok" | "aic_staff"
//             (the role powers the aic_staff_count / nok_count /
//              caregiver_count columns on the ServiceNow table)
//
// How to fill this in:
//   1. Create a Telegram bot via @BotFather and grab the bot token.
//      Add it to backend_api/.env as TELEGRAM_BOT_TOKEN.
//   2. Each person who should receive check-in alerts opens a chat
//      with the bot, sends /start (required — bots can't reach users
//      that haven't initiated contact), then messages @userinfobot to
//      discover their numeric chat_id.
//   3. Add an entry below, tagging their role.
//
// Empty / malformed entries / duplicates are dropped at runtime by
// telegramService.js, so the buckets may start as `[]` and you can
// fill them gradually during development without errors.
//
// Bucket semantics:
//   caregiver_aic      → routine check-in (caregiver + AIC staff)
//   caregiver_nok_aic  → escalation bucket (also pages the NOK)
module.exports = {
  caregiver_nok_aic: [
    // { chat_id: "6219384712", role: "caregiver" },
    // { chat_id: "9123456789", role: "nok" },
    // { chat_id: "9876543210", role: "aic_staff" },
  ],
  caregiver_aic: [
    // Smoke-test recipient — comes from getUpdates after afiqahhh
    // pressed /start on the bot:
    //   curl https://api.telegram.org/bot<TOKEN>/getUpdates
    // Tagged as "caregiver" so the routine "I'm Okay" press (which
    // uses this caregiver_aic bucket) actually fires a Telegram
    // message during the demo. SN row will land with
    //   caregiver_count=1, nok_count=0, aic_staff_count=0.
    { chat_id: "465381986", role: "caregiver" },
    // Add more recipients above this comment as you collect them:
    //   { chat_id: "6219384712", role: "caregiver" },
    //   { chat_id: "9876543210", role: "aic_staff" },
  ],
};