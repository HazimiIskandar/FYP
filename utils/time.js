// All timestamps in this app are rendered in Singapore Time (UTC+08:00)
// regardless of the device's local timezone or the backend's session
// timezone. The MySQL session stores UTC instants via CURRENT_TIMESTAMP,
// but every visible wall-clock value — DOB, check-in time, case creation
// time, streak buckets — must show SGT so users see the time they actually
// pressed/recorded locally.
//
// Helpers in this file:
//
//   Display (Date | ISO string | timestamp -> SGT string):
//     - formatDate       : SGT DD/MM/YYYY
//     - formatDateTime   : SGT DD MMM YYYY, HH:mm
//     - formatTime       : SGT HH:mm
//
//   Normalisation / parsing (multi-format input string -> canonical form):
//     - normalizeDateString : anything -> "DD/MM/YYYY"
//     - parseDateParts      : anything -> { day, month, year }
//
//   Database round-trip:
//     - formatDateForDB     : "DD/MM/YYYY" | "YYYY-MM-DD" -> "YYYY-MM-DD" | null
//
//   Streak / system (UTC instant -> SGT calendar day key):
//     - getSgtDateKey       : Date | ISO -> "YYYY-MM-DD"
//     - isSgtToday          : Date | ISO -> boolean
//
// Display helpers return the caller's `fallback` (default `''`) for missing
// or invalid input, so callers can do
//   formatDate(value) || t('profile.notRecorded')
// or pass an explicit fallback like
//   formatDate(value, 'Not recorded').

const SGT_TIMEZONE = 'Asia/Singapore';

const isMissing = (value) => value === null || value === undefined || value === '';

const toDate = (value) => {
  if (value instanceof Date) return value;
  const str = String(value).trim();
  // MySQL DATETIME strings arrive from the backend in SGT (session timezone
  // is +08:00).  JavaScript's Date constructor interprets bare datetime
  // strings ("YYYY-MM-DD HH:mm:ss") inconsistently across engines — V8
  // treats them as LOCAL time, Safari as UTC.  To avoid this cross-engine
  // ambiguity, we detect the MySQL format and append the explicit SGT
  // offset so every runtime parses it the same way.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    return new Date(str.replace(' ', 'T') + '+08:00');
  }
  return new Date(str);
};

// ---------------------------------------------------------------------------
// DISPLAY
// ---------------------------------------------------------------------------

export const formatDate = (value, fallback = '') => {
  if (isMissing(value)) return fallback;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: SGT_TIMEZONE,
  });
};

export const formatDateTime = (value, fallback = '') => {
  if (isMissing(value)) return fallback;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;

  // 12-hour format (e.g. "28 Jun 2026, 02:04 PM"). We compute the date and
  // time parts separately and append a HARD-CODED uppercase AM/PM marker
  // because Hermes/ICU's en-SG 12-hour renderer can emit lowercase "pm"
  // depending on the engine, and ICU option shapes for force-uppercase
  // markers aren't universally supported on every React Native runtime.
  const datePart = new Intl.DateTimeFormat('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: SGT_TIMEZONE,
  }).format(date);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: SGT_TIMEZONE,
  }).formatToParts(date);
  const get = (t) => timeParts.find((p) => p.type === t)?.value || '';
  const hour24 = Number(get('hour'));
  const minute = get('minute');
  const hour12 = String((hour24 % 12) || 12).padStart(2, '0');
  const ampm = hour24 < 12 ? 'AM' : 'PM';

  return `${datePart}, ${hour12}:${minute} ${ampm}`;
};

export const formatTime = (value, fallback = '') => {
  if (isMissing(value)) return fallback;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: SGT_TIMEZONE,
  });
};

// ---------------------------------------------------------------------------
// NORMALISATION / PARSING
// ---------------------------------------------------------------------------

export const normalizeDateString = (value) => {
  if (isMissing(value)) return '';

  const stringValue = `${value}`.trim();

  const isoMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const slashYmdMatch = stringValue.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slashYmdMatch) {
    return `${slashYmdMatch[3]}/${slashYmdMatch[2]}/${slashYmdMatch[1]}`;
  }

  const displayMatch = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return stringValue;
  }

  const dashDisplayMatch = stringValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashDisplayMatch) {
    return `${dashDisplayMatch[1]}/${dashDisplayMatch[2]}/${dashDisplayMatch[3]}`;
  }

  // Last resort: parse as a Date and extract SGT wall-clock so we never land
  // on the wrong day because of an off-by-one on a UTC device.
  const date = new Date(stringValue);
  if (!Number.isNaN(date.getTime())) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: SGT_TIMEZONE,
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value || '';
    return `${get('day')}/${get('month')}/${get('year')}`;
  }

  return '';
};

export const parseDateParts = (value) => {
  if (isMissing(value)) return { day: '', month: '', year: '' };

  const normalized = `${value}`.trim();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return { day: isoMatch[3], month: isoMatch[2], year: isoMatch[1] };

  const dbMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dbMatch) return { day: dbMatch[3], month: dbMatch[2], year: dbMatch[1] };

  const dbSlashMatch = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (dbSlashMatch) return { day: dbSlashMatch[3], month: dbSlashMatch[2], year: dbSlashMatch[1] };

  const displayMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) return { day: displayMatch[1], month: displayMatch[2], year: displayMatch[3] };

  const dashDisplayMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashDisplayMatch) return { day: dashDisplayMatch[1], month: dashDisplayMatch[2], year: dashDisplayMatch[3] };

  return { day: '', month: '', year: '' };
};

// ---------------------------------------------------------------------------
// DATABASE ROUND-TRIP
// ---------------------------------------------------------------------------

export const formatDateForDB = (value) => {
  if (isMissing(value)) return null;

  const normalized = `${value}`.trim();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dbMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dbMatch) return value;

  const dashDisplayMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashDisplayMatch) {
    return `${dashDisplayMatch[3]}-${dashDisplayMatch[2]}-${dashDisplayMatch[1]}`;
  }

  const parts = normalized.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// STREAK / "today" HELPERS
// ---------------------------------------------------------------------------

export const getSgtDateKey = (value) => {
  if (isMissing(value)) return null;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: SGT_TIMEZONE,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export const isSgtToday = (value) => {
  const todayKey = getSgtDateKey(new Date());
  const valueKey = getSgtDateKey(value);
  return Boolean(todayKey && valueKey && todayKey === valueKey);
};

// One SGT "calendar day" in milliseconds — used by formatRelativeTime to
// bucket "today / yesterday / N days ago" so two check-ins landed on the
// same SGT day don't get split by a UTC midnight rollover.
const SGT_DAY_MS = 24 * 60 * 60 * 1000;

// "Just now" / "5 minutes ago" / "2 hours ago" / "Yesterday at 09:00 AM"
// / "3 days ago" / older -> formatDateTime. All comparisons are done in the
// SGT clock so "today" matches what the rest of the app shows elsewhere.
//
// Returns `fallback` for missing/invalid input so callers can chain a
// localised "No check-in yet" placeholder when the value is null.
export const getSgtHours = (value) => {
  if (isMissing(value)) return -1;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return -1;
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hour12: false,
    timeZone: SGT_TIMEZONE,
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
};

export const getSgtHours = (value) => {
  if (isMissing(value)) return -1;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return -1;
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hour12: false,
    timeZone: SGT_TIMEZONE,
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
};

export const formatRelativeTime = (value, fallback = '') => {
  if (isMissing(value)) return fallback;
  const valueDate = toDate(value);
  const now = new Date();
  if (Number.isNaN(valueDate.getTime())) return fallback;

  const diffMs = now.getTime() - valueDate.getTime();
  // Future-dated values (off clock) get the absolute SGT date+time so we
  // always show *something* — never a negative direction like "-2 minutes".
  if (diffMs < 0) return formatDateTime(valueDate);

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  // Cross the SGT-day boundary. Compare YYYY-MM-DD keys so a check-in at
  // 23:50 SGT and a check at 00:30 SGT the next morning both roll into
  // "Yesterday at …" — not "1 day ago" purely because 24h has elapsed.
  const valueKey = getSgtDateKey(valueDate);
  const todayKey = getSgtDateKey(now);
  const yesterdayKey = (() => {
    const yesterday = new Date(now.getTime() - SGT_DAY_MS);
    return getSgtDateKey(yesterday);
  })();

  if (valueKey === todayKey) {
    // <24h AND same SGT day — fall back to "X hours ago" style by hours so
    // caregivers see "23 hours ago" without a confusing "Today at …".
    return `${diffHours} hours ago`;
  }
  if (valueKey === yesterdayKey) {
    return `Yesterday at ${formatTime(valueDate, '')}`;
  }

  const diffDays = Math.floor(diffMs / SGT_DAY_MS);
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  return formatDateTime(valueDate);
};
