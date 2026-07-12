// ---------------------------------------------------------------------------------
// backend_api/telegramRecipients.js
//
// Maps a routing bucket (see backend_api/routes/checkInRoutes.js:
// notify_bucket) to the list of Telegram chat_ids that should receive a
// check-in ping.
//
// To find the chat_id for a new person, they need to /start the bot once,
// then run:
//   curl https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
// and read chat.id from the response.
//
// NOTE: chat_ids may repeat safely — backend_api/services/telegramService.js
// already dedupes via Set before sending.
// ---------------------------------------------------------------------------------
//
// CURRENT STATE: Solo FYP dev. We only have ONE verified chat_id at the
// moment (afiqahhh's private chat with the bot). It is duplicated across all
// 4 slots so every check-in fan-out slot still has a recipient to land on.
// The ServiceNow column u_workflow_route will still differentiate which
// bucket fired.
//
// Replace these with real chat_ids once caregivers / NOKs / AIC staff have
// onboarded and /started the bot.
// ---------------------------------------------------------------------------------

module.exports = {
  // "caregiver" + "next-of-kin" + "AIC staff" — the senior's primary care
  // circle. Slot[0] usually = caregiver, slot[1] = NOK.
  caregiver_nok_aic: [
    "465381986",
    "465381986",
  ],
  // "caregiver" + "AIC staff" — academic / operational audience; no NOK ping.
  // Slot[0] = caregiver, slot[1] = AIC staff.
  caregiver_aic: [
    "465381986",
    "465381986",
  ],
};
