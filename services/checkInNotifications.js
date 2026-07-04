import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_NOTIFICATION_IDS = [];
const CHECK_IN_NOTIFICATION_TYPE = 'check-in-reminder';

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

    await Notifications.setNotificationChannelAsync('urgent-check-in-reminders', {
      name: 'Urgent check-in reminders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500, 250, 500],
    });
  }

  return true;
}

export async function scheduleCheckInReminders(seniorName = 'Senior', checkInTime1 = '09:00', checkInTime2 = '19:00') {
  const hasPermission = await setupCheckInNotifications();

  if (!hasPermission) {
    return false;
  }

  await cancelMissedCheckInReminders();

  const reminders1 = getDailyReminderTriggers(checkInTime1);
  const reminders2 = getDailyReminderTriggers(checkInTime2);
  const allReminders = [...reminders1, ...reminders2];

  for (const reminder of allReminders) {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body.replace('{seniorName}', seniorName),
        sound: 'default',
        priority: reminder.priority,
        data: { type: CHECK_IN_NOTIFICATION_TYPE },
      },
      trigger: reminder.trigger,
    });

    REMINDER_NOTIFICATION_IDS.push(notificationId);
  }

  return true;
}

export async function scheduleMissedCheckInReminders(seniorName = 'Senior', checkInTime1 = '09:00', checkInTime2 = '19:00') {
  return scheduleCheckInReminders(seniorName, checkInTime1, checkInTime2);
}

export async function cancelMissedCheckInReminders() {
  while (REMINDER_NOTIFICATION_IDS.length > 0) {
    const notificationId = REMINDER_NOTIFICATION_IDS.pop();
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

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
        channelId: 'check-in-reminders',
      },
    },
    {
      title: 'Important: check in soon',
      body: '{seniorName}, please get ready to check in. Your caregiver is waiting for your status.',
      priority: Notifications.AndroidNotificationPriority.MAX,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: fifteenMinuteReminder.hour,
        minute: fifteenMinuteReminder.minute,
        channelId: 'urgent-check-in-reminders',
      },
    },
  ];
}

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
  // Accept either a single time ('9:00 AM') or a range
  // ('9:00 AM - 10:00 AM'). For ranges we use the START time so the
  // daily reminder fires 30 and 15 minutes before the senior's check-in
  // window opens.
  const trimmed = String(value || '').trim();
  const startTime = trimmed.includes('-')
    ? trimmed.split('-')[0].trim()
    : trimmed;
  const match = startTime.match(/^(1[0-2]|[1-9]):([0-5]\d)\s?(AM|PM)$/i);

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
}
