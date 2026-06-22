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

const normalizeTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateCurrentStreak = (checkins = []) => {
  const orderedDates = checkins
    .map((entry) => toDateKey(entry?.checkin_timestamp || entry?.date || entry?.created_at))
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left));

  if (orderedDates.length === 0) {
    return 0;
  }

  let streak = 1;
  let previousDate = new Date(`${orderedDates[0]}T00:00:00`);

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

const getDailyPoints = (rewardRow, todayKey) => {
  if (!rewardRow || rewardRow.daily_points_date !== todayKey) {
    return 0;
  }

  return Number(rewardRow.daily_points || 0);
};

const getRemainingDailyPoints = (rewardRow, todayKey, dailyCap = 50) => {
  return Math.max(0, dailyCap - getDailyPoints(rewardRow, todayKey));
};

const applyDailyPointsAward = (rewardRow, todayKey, requestedPoints, dailyCap = 50) => {
  const currentDailyPoints = getDailyPoints(rewardRow, todayKey);
  const remaining = Math.max(0, dailyCap - currentDailyPoints);
  const awardedPoints = Math.max(0, Math.min(Number(requestedPoints || 0), remaining));

  return {
    awardedPoints,
    nextDailyPoints: currentDailyPoints + awardedPoints,
    nextDailyPointsDate: todayKey,
  };
};

module.exports = {
  applyDailyPointsAward,
  calculateCurrentStreak,
  getDailyPoints,
  getRemainingDailyPoints,
  normalizeTimestamp,
  toDateKey,
};