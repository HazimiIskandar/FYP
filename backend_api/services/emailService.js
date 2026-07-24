// ---------------------------------------------------------------------------------
// backend_api/services/emailService.js
//
// Sends the "Senior check-in confirmed" notification through Gmail SMTP.
// Auth is via App Password (not the user's real password) on the same Gmail
// account that authenticates the SMTP session. The recipient address is
// resolved dynamically from User_Account.email via the Senior_has_Caregiver
// linkage, so the Send-As (GMAIL_USER) and the recipient addresses can be
// different accounts. One .env pair is all that's needed for auth.
//
// Required env:
//   GMAIL_USER         — Gmail address that authenticates the SMTP session
//                        (also becomes the From: header)
//   GMAIL_APP_PASSWORD — 16-char App Password generated at
//                        https://myaccount.google.com/apppasswords
//
// Contract:
//   - never throws; logs and returns { ok: false, error } on failure
//   - transport is lazy-initialised + cached so we don't re-handshake SMTP
//     for every check-in
//   - callers in services/notificationFanout.js treat this exactly like
//     any other sink: per-sink failure is logged, never blocks /checkin
// ---------------------------------------------------------------------------------

const nodemailer = require("nodemailer");
const { nowSgtIso } = require("../utils/time");

let cachedTransport = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "[emailService] GMAIL_USER and GMAIL_APP_PASSWORD must be set in env"
    );
  }

  cachedTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL on connect — Google-facing SMTP
    auth: { user, pass },
  });
  return cachedTransport;
}

/**
 * Send a "Senior check-in confirmed" email to one recipient.
 *
 * Idempotent at the SMTP layer (each call sends a new message). Google
 * may dedupe visually if the same body arrives twice within 5 minutes —
 * not a concern for check-in traffic.
 *
 * @param {Object} args
 * @param {string} args.to           — recipient Gmail address
 * @param {string} [args.seniorName] — shown in subject + body; defaults to "a senior"
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
async function sendCheckInNotificationEmail({ to, seniorName }) {
  if (!to) {
    return { ok: false, error: "recipient email missing" };
  }

  const subject = `Senior check-in confirmed — ${seniorName || "a senior"}`;
  const checkinAt = nowSgtIso();
  const text = [
    "Hello,",
    "",
    `${seniorName || "A senior"} has just confirmed they are okay at ${checkinAt}.`,
    "",
    "Triggered via the SilverGrove Caregiver check-in workflow.",
  ].join("\n");

  try {
    const transport = getTransport();
    const info = await transport.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const reason = (err && err.message) || String(err);
    console.warn("[emailService] send failed to=" + to + " reason=" + reason);
    return { ok: false, error: reason };
  }
}

module.exports = {
  sendCheckInNotificationEmail,
};
