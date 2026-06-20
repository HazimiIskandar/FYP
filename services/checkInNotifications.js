import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_NOTIFICATION_IDS = [];
<<<<<<< HEAD
const CHECK_IN_NOTIFICATION_TYPE = 'check-in-reminder';
=======

// Demo mode makes reminders appear quickly during presentation/testing.
// Change this to false when your backend team uses real daily schedules.
const USE_DEMO_TIMING = true;
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupCheckInNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('check-in-reminders', {
      name: 'Check-in reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
<<<<<<< HEAD

    await Notifications.setNotificationChannelAsync('urgent-check-in-reminders', {
      name: 'Urgent check-in reminders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500, 250, 500],
    });
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  }

  return true;
}

<<<<<<< HEAD
export async function scheduleCheckInReminders(seniorName = 'Senior', checkInTime = '09:00') {
  const hasPermission = await setupCheckInNotifications();

  if (!hasPermission) {
    return false;
=======
export async function scheduleMissedCheckInReminders(seniorName = 'Mr. Tan') {
  const hasPermission = await setupCheckInNotifications();

  if (!hasPermission) {
    return;
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  }

  await cancelMissedCheckInReminders();

<<<<<<< HEAD
  const reminders = getDailyReminderTriggers(checkInTime);
=======
  const reminders = USE_DEMO_TIMING
    ? getDemoReminderTriggers()
    : getDailyReminderTriggers();
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e

  for (const reminder of reminders) {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body.replace('{seniorName}', seniorName),
        sound: 'default',
<<<<<<< HEAD
        priority: reminder.priority,
        data: { type: CHECK_IN_NOTIFICATION_TYPE },
=======
        priority: Notifications.AndroidNotificationPriority.HIGH,
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
      },
      trigger: reminder.trigger,
    });

    REMINDER_NOTIFICATION_IDS.push(notificationId);
  }
<<<<<<< HEAD

  return true;
}

export async function scheduleMissedCheckInReminders(seniorName = 'Senior', checkInTime = '09:00') {
  return scheduleCheckInReminders(seniorName, checkInTime);
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
}

export async function cancelMissedCheckInReminders() {
  while (REMINDER_NOTIFICATION_IDS.length > 0) {
    const notificationId = REMINDER_NOTIFICATION_IDS.pop();
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
<<<<<<< HEAD

  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

  await Promise.all(
    scheduledNotifications
      .filter((notification) => notification?.content?.data?.type === CHECK_IN_NOTIFICATION_TYPE)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

function getDailyReminderTriggers(checkInTime) {
  const thirtyMinuteReminder = subtractMinutesFromTime(checkInTime, 30);
  const fifteenMinuteReminder = subtractMinutesFromTime(checkInTime, 15);

  return [
    {
      title: 'Check-in soon',
      body: 'Hi {seniorName}, your daily check-in opens in 30 minutes.',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: thirtyMinuteReminder.hour,
        minute: thirtyMinuteReminder.minute,
=======
}

function getDemoReminderTriggers() {
  return [
    {
      title: 'Check-in Reminder',
      body: 'Hi {seniorName}, it is time for your daily check-in. Tap here to open.',
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
        channelId: 'check-in-reminders',
      },
    },
    {
<<<<<<< HEAD
      title: 'Important: check in soon',
      body: '{seniorName}, please get ready to check in. Your caregiver is waiting for your status.',
      priority: Notifications.AndroidNotificationPriority.MAX,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: fifteenMinuteReminder.hour,
        minute: fifteenMinuteReminder.minute,
        channelId: 'urgent-check-in-reminders',
=======
      title: 'Still there?',
      body: '{seniorName}, please check in now.',
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 25,
        channelId: 'check-in-reminders',
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
      },
    },
  ];
}

<<<<<<< HEAD
export function isValidCheckInTime(value) {
  return parseCheckInTime(value) !== null;
}

function subtractMinutesFromTime(timeValue, minutesToSubtract) {
  const parsedTime = parseCheckInTime(timeValue) || { hour: 9, minute: 0 };
  const { hour: hourValue, minute: minuteValue } = parsedTime;
  const totalMinutes = (hourValue * 60 + minuteValue - minutesToSubtract + 24 * 60) % (24 * 60);

  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

function parseCheckInTime(value) {
  const match = String(value || '').trim().match(/^(1[0-2]|[1-9]):([0-5]\d)\s?(AM|PM)$/i);

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  if (period === 'PM' && hour !== 12) {
    hour += 12;
  }

  return { hour, minute };
=======
function getDailyReminderTriggers() {
  return [
    {
      title: 'Check-in Reminder',
      body: 'Hi {seniorName}, it is time for your daily check-in. Tap here to open.',
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 50,
        channelId: 'check-in-reminders',
      },
    },
    {
      title: 'Still there?',
      body: '{seniorName}, please check in now.',
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 10,
        minute: 0,
        channelId: 'check-in-reminders',
      },
    },
  ];
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
}
