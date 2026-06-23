const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getEngagementTimestamp = (entry = {}) =>
  entry.checkin_timestamp ||
  entry.activity_date ||
  entry.date ||
  entry.created_at ||
  entry.timestamp;

const isCompletedEngagement = (entry = {}) => {
  const checkInStatus = `${entry.checkin_status || ''}`.toLowerCase();
  const participationStatus = `${entry.participation_status || ''}`.toLowerCase();

  if (!checkInStatus && !participationStatus) {
    return true;
  }

  return checkInStatus.includes('completed') || participationStatus === 'completed';
};

const calculateCurrentStreak = (engagements = []) => {
  const orderedDates = Array.from(
    new Set(
      engagements
        .filter(isCompletedEngagement)
        .map((entry) => toDateKey(getEngagementTimestamp(entry)))
        .filter(Boolean)
    )
  ).sort((left, right) => right.localeCompare(left));

  if (orderedDates.length === 0) {
    return 0;
  }

  const todayKey = toDateKey(new Date());
  const mostRecentKey = orderedDates[0];
  const mostRecentDate = new Date(`${mostRecentKey}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  const daysSinceLast = Math.round((today - mostRecentDate) / DAY_MS);

  // Streak is broken if last check-in was more than 1 day ago
  if (daysSinceLast > 1) {
    return 0;
  }

  let streak = 1;
  let previousDate = mostRecentDate;

  for (let index = 1; index < orderedDates.length; index += 1) {
    const currentDate = new Date(`${orderedDates[index]}T00:00:00`);
    const differenceInDays = Math.round((previousDate - currentDate) / DAY_MS);

    if (differenceInDays === 0) {
      continue;
    }

    if (differenceInDays === 1) {
      streak += 1;
      previousDate = currentDate;
      continue;
    }

    break;
  }

  return streak;
};

module.exports = {
  calculateCurrentStreak,
  getEngagementTimestamp,
  isCompletedEngagement,
  toDateKey,
};
