import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ScheduledReminder } from '../core/notification';
import { nativeNotificationReliability, type ExactAlarmCapability } from './nativeReliability';

const OWNER = 'suisui-calendar';
const TEST_OWNER = 'suisui-calendar-diagnostic';
const TEST_IDENTIFIER = 'suisui-notification-test';
export const CHANNEL_ID = 'important-dates-v2';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';
export type NotificationChannelStatus =
  'ready' | 'missing' | 'blocked' | 'low-priority' | 'silent' | 'not-applicable';

export type NotificationDiagnostics = {
  permission: ReminderPermission;
  exactAlarm: ExactAlarmCapability;
  channel: NotificationChannelStatus;
  scheduledCount: number;
};

export interface NotificationScheduler {
  supported: boolean;
  getPermission(): Promise<ReminderPermission>;
  ensurePermission(): Promise<ReminderPermission>;
  getDiagnostics(): Promise<NotificationDiagnostics>;
  replace(reminders: ScheduledReminder[]): Promise<number>;
  clear(): Promise<void>;
  scheduleTest(seconds?: number): Promise<string>;
  openNotificationSettings(): Promise<void>;
  openExactAlarmSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
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
    name: '重要日期提醒（可靠）',
    description: '节日、节气、生日和时光记周年当天的顶部横幅与锁屏提醒',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 180, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function permissionStatus(permission: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (permission.granted) return 'granted';
  return permission.status === 'undetermined' ? 'undetermined' : 'denied';
}

async function channelStatus(): Promise<NotificationChannelStatus> {
  if (Platform.OS !== 'android') return 'not-applicable';
  const channel = await Notifications.getNotificationChannelAsync(CHANNEL_ID);
  if (!channel) return 'missing';
  if (channel.importance === Notifications.AndroidImportance.NONE) return 'blocked';
  if (channel.importance < Notifications.AndroidImportance.HIGH) return 'low-priority';
  if (!channel.sound || !channel.enableVibrate) return 'silent';
  return 'ready';
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

async function verifyScheduled(reminders: ScheduledReminder[]): Promise<number> {
  const expected = new Set(reminders.map((reminder) => reminder.identifier));
  const scheduled = await ownedRequests();
  const saved = scheduled.filter((request) => expected.has(request.identifier));
  if (saved.length !== expected.size) {
    throw new Error(`系统只保存了 ${saved.length}/${expected.size} 条提醒，请检查系统限制后重试。`);
  }
  return saved.length;
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
    return permissionStatus(permission);
  },
  async ensurePermission() {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    const requested = await Notifications.requestPermissionsAsync();
    return permissionStatus(requested);
  },
  async getDiagnostics() {
    await ensureChannel();
    const [permission, exactAlarm, channel, scheduled] = await Promise.all([
      Notifications.getPermissionsAsync().then(permissionStatus),
      nativeNotificationReliability.exactAlarmCapability(),
      channelStatus(),
      ownedRequests(),
    ]);
    return { permission, exactAlarm, channel, scheduledCount: scheduled.length };
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
      return verifyScheduled(reminders);
    });
  },
  clear: () => enqueue(clearOwned),
  async scheduleTest(seconds = 60) {
    await ensureChannel();
    if (permissionStatus(await Notifications.getPermissionsAsync()) !== 'granted') {
      throw new Error('请先允许岁岁日历发送通知，再安排测试提醒。');
    }
    await Notifications.cancelScheduledNotificationAsync(TEST_IDENTIFIER);
    return Notifications.scheduleNotificationAsync({
      identifier: TEST_IDENTIFIER,
      content: {
        title: '岁岁日历测试通知',
        body: '如果你在锁屏或划掉应用后看到这条顶部提醒，说明系统通知链路可用。',
        sound: 'default',
        data: { owner: TEST_OWNER, kind: 'diagnostic' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  },
  openNotificationSettings: () => nativeNotificationReliability.openNotificationSettings(CHANNEL_ID),
  openExactAlarmSettings: () => nativeNotificationReliability.openExactAlarmSettings(),
  openBatterySettings: () => nativeNotificationReliability.openBatterySettings(),
};
