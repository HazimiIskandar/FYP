import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_NOTIFICATION_IDS = [];

// Demo mode makes reminders appear quickly during presentation/testing.
// Change this to false when your backend team uses real daily schedules.
const USE_DEMO_TIMING = true;

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
  }

  return true;
}

export async function scheduleMissedCheckInReminders(seniorName = 'Mr. Tan') {
  const hasPermission = await setupCheckInNotifications();

  if (!hasPermission) {
    return;
  }

  await cancelMissedCheckInReminders();

  const reminders = USE_DEMO_TIMING
    ? getDemoReminderTriggers()
    : getDailyReminderTriggers();

  for (const reminder of reminders) {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body.replace('{seniorName}', seniorName),
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: reminder.trigger,
    });

    REMINDER_NOTIFICATION_IDS.push(notificationId);
  }
}

export async function cancelMissedCheckInReminders() {
  while (REMINDER_NOTIFICATION_IDS.length > 0) {
    const notificationId = REMINDER_NOTIFICATION_IDS.pop();
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}

function getDemoReminderTriggers() {
  return [
    {
      title: 'Check-in Reminder',
      body: 'Hi {seniorName}, it is time for your daily check-in. Tap here to open.',
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        channelId: 'check-in-reminders',
      },
    },
    {
      title: 'Still there?',
      body: '{seniorName}, please check in now.',
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 25,
        channelId: 'check-in-reminders',
      },
    },
  ];
}

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
}
