import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ScheduledReminder } from '../core/notification';

const OWNER = 'suisui-calendar';
const CHANNEL_ID = 'important-dates';

export type ReminderPermission = 'granted' | 'denied';

export interface NotificationScheduler {
  supported: boolean;
  getPermission(): Promise<ReminderPermission>;
  ensurePermission(): Promise<ReminderPermission>;
  replace(reminders: ScheduledReminder[]): Promise<number>;
  clear(): Promise<void>;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '重要日期提醒',
    description: '生日和时光记周年当天的提醒',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 180, 250],
  });
}

async function ownedRequests() {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  return requests.filter((request) => request.content.data?.owner === OWNER);
}

async function clearOwned(): Promise<void> {
  const requests = await ownedRequests();
  await Promise.all(
    requests.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

let schedulingQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = schedulingQueue.then(work, work);
  schedulingQueue = result.catch(() => {});
  return result;
}

export const notificationScheduler: NotificationScheduler = {
  supported: true,
  async getPermission() {
    const permission = await Notifications.getPermissionsAsync();
    return permission.granted ? 'granted' : 'denied';
  },
  async ensurePermission() {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted ? 'granted' : 'denied';
  },
  async replace(reminders) {
    return enqueue(async () => {
      await ensureChannel();
      await clearOwned();
      for (const reminder of reminders) {
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.identifier,
          content: {
            title: reminder.title,
            body: reminder.body,
            sound: 'default',
            data: {
              owner: OWNER,
              kind: reminder.kind,
              itemId: reminder.itemId,
              date: reminder.date,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.triggerAt,
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
          },
        });
      }
      return reminders.length;
    });
  },
  clear: () => enqueue(clearOwned),
};
