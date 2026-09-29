import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ScheduledReminder } from '../core/notification';
import {
  nativeNotificationReliability,
  type ExactAlarmCapability,
  type FullScreenCapability,
} from './nativeReliability';

const OWNER = 'suisui-calendar';
const TEST_OWNER = 'suisui-calendar-diagnostic';
const TEST_IDENTIFIER = 'suisui-notification-test';
export const CHANNEL_ID = 'important-dates-popup-v3';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';
export type NotificationChannelStatus = 'ready' | 'missing' | 'blocked' | 'low-priority' | 'not-applicable';

export type NotificationDiagnostics = {
  permission: ReminderPermission;
  appNotificationsEnabled: boolean;
  exactAlarm: ExactAlarmCapability;
  fullScreen: FullScreenCapability;
  channel: NotificationChannelStatus;
  channelImportance: number | null;
  soundEnabled: boolean | null;
  vibrationEnabled: boolean | null;
  floatingBanner: 'manual-check' | 'not-applicable';
  scheduledCount: number;
  registeredCount: number;
  lastTestScheduledAt: number;
  lastTestTriggerAt: number;
  lastDeliveryAt: number;
  lastDeliveryIdentifier: string;
};

export type DelayedTestRegistration = {
  identifier: string;
  triggerAt: number;
};

export interface NotificationScheduler {
  supported: boolean;
  getPermission(): Promise<ReminderPermission>;
  ensurePermission(): Promise<ReminderPermission>;
  getDiagnostics(): Promise<NotificationDiagnostics>;
  replace(reminders: ScheduledReminder[], fullScreen?: boolean): Promise<number>;
  clear(): Promise<void>;
  sendImmediateTest(): Promise<string>;
  scheduleDelayedTest(seconds?: number, fullScreen?: boolean): Promise<DelayedTestRegistration>;
  openNotificationSettings(): Promise<void>;
  openExactAlarmSettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await nativeNotificationReliability.ensureChannel();
}

function permissionStatus(permission: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (permission.granted) return 'granted';
  return permission.status === 'undetermined' ? 'undetermined' : 'denied';
}

function nativeChannelStatus(exists: boolean, importance: number): NotificationChannelStatus {
  if (!exists) return 'missing';
  if (importance <= 0) return 'blocked';
  if (importance < 4) return 'low-priority';
  return 'ready';
}

async function ownedExpoRequests(owner = OWNER) {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  return requests.filter((request) => request.content.data?.owner === owner);
}

async function clearOwnedExpo(): Promise<void> {
  const requests = await ownedExpoRequests();
  await Promise.all(
    requests.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

async function verifyExpoScheduled(reminders: ScheduledReminder[]): Promise<number> {
  const expected = new Set(reminders.map((reminder) => reminder.identifier));
  const scheduled = await ownedExpoRequests();
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
  supported: Platform.OS !== 'android' || nativeNotificationReliability.available,
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
    if (Platform.OS === 'android') {
      await ensureChannel();
      const [permission, native] = await Promise.all([
        Notifications.getPermissionsAsync().then(permissionStatus),
        nativeNotificationReliability.diagnostics(),
      ]);
      return {
        permission,
        appNotificationsEnabled: native.appNotificationsEnabled,
        exactAlarm: native.exactAlarmAvailable ? 'available' : 'unavailable',
        fullScreen: native.fullScreenIntentAvailable ? 'available' : 'unavailable',
        channel: nativeChannelStatus(native.channelExists, native.channelImportance),
        channelImportance: native.channelImportance,
        soundEnabled: native.channelSoundEnabled,
        vibrationEnabled: native.channelVibrationEnabled,
        floatingBanner: 'manual-check',
        scheduledCount: native.scheduledCount,
        registeredCount: native.registeredCount,
        lastTestScheduledAt: native.lastTestScheduledAt,
        lastTestTriggerAt: native.lastTestTriggerAt,
        lastDeliveryAt: native.lastDeliveryAt,
        lastDeliveryIdentifier: native.lastDeliveryIdentifier,
      };
    }
    const [permission, scheduled] = await Promise.all([
      Notifications.getPermissionsAsync().then(permissionStatus),
      ownedExpoRequests(),
    ]);
    return {
      permission,
      appNotificationsEnabled: permission === 'granted',
      exactAlarm: 'not-applicable',
      fullScreen: 'not-applicable',
      channel: 'not-applicable',
      channelImportance: null,
      soundEnabled: null,
      vibrationEnabled: null,
      floatingBanner: 'not-applicable',
      scheduledCount: scheduled.length,
      registeredCount: scheduled.length,
      lastTestScheduledAt: 0,
      lastTestTriggerAt: 0,
      lastDeliveryAt: 0,
      lastDeliveryIdentifier: '',
    };
  },
  async replace(reminders, fullScreen = false) {
    return enqueue(async () => {
      if (Platform.OS === 'android') {
        await ensureChannel();
        // 0.3.0 及更早版本使用 Expo 排程；迁移到原生链路时先清理旧生产任务，避免重复提醒。
        await clearOwnedExpo();
        const result = await nativeNotificationReliability.replace(reminders, fullScreen);
        const expected = new Set(reminders.map((reminder) => reminder.identifier));
        const registered = new Set(result.identifiers);
        if (
          result.expectedCount !== expected.size ||
          result.registeredCount !== expected.size ||
          [...expected].some((identifier) => !registered.has(identifier))
        ) {
          throw new Error(
            `原生系统只登记了 ${result.registeredCount}/${expected.size} 条提醒，请检查系统限制后重试。`,
          );
        }
        return result.registeredCount;
      }
      await clearOwnedExpo();
      for (const reminder of reminders) {
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.identifier,
          content: {
            title: reminder.title,
            body: reminder.body,
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
          },
        });
      }
      return verifyExpoScheduled(reminders);
    });
  },
  clear: () =>
    enqueue(async () => {
      if (Platform.OS === 'android') {
        await Promise.all([nativeNotificationReliability.clear(), clearOwnedExpo()]);
      } else {
        await clearOwnedExpo();
      }
    }),
  async sendImmediateTest() {
    await ensureChannel();
    if (permissionStatus(await Notifications.getPermissionsAsync()) !== 'granted') {
      throw new Error('请先允许岁岁日历发送通知，再发送测试横幅。');
    }
    if (Platform.OS === 'android') {
      const result = await nativeNotificationReliability.sendImmediateTest();
      if (!result.delivered) throw new Error('系统拒绝了测试通知，请检查应用通知总开关。');
      return result.identifier;
    }
    return Notifications.scheduleNotificationAsync({
      identifier: `${TEST_IDENTIFIER}-immediate`,
      content: {
        title: '岁岁日历横幅测试',
        body: '这是一条立即发送的静默测试通知。',
        data: { owner: TEST_OWNER, kind: 'diagnostic-immediate' },
      },
      trigger: null,
    });
  },
  async scheduleDelayedTest(seconds = 60, fullScreen = false) {
    await ensureChannel();
    if (permissionStatus(await Notifications.getPermissionsAsync()) !== 'granted') {
      throw new Error('请先允许岁岁日历发送通知，再安排测试提醒。');
    }
    const triggerAt = Date.now() + seconds * 1000;
    if (Platform.OS === 'android') {
      const result = await nativeNotificationReliability.scheduleDelayedTest(triggerAt, fullScreen);
      if (!result.registered) {
        throw new Error('原生定时任务登记失败，请检查“闹钟和提醒”与后台权限。');
      }
      return { identifier: result.identifier, triggerAt: result.triggerAt };
    }
    await Notifications.cancelScheduledNotificationAsync(TEST_IDENTIFIER);
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: TEST_IDENTIFIER,
      content: {
        title: '岁岁日历测试通知',
        body: '这是一条延时测试通知。',
        data: { owner: TEST_OWNER, kind: 'diagnostic-delayed' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    const saved = await ownedExpoRequests(TEST_OWNER);
    if (!saved.some((request) => request.identifier === identifier)) {
      throw new Error('系统没有保存测试提醒，请检查系统限制后重试。');
    }
    return { identifier, triggerAt };
  },
  openNotificationSettings: () => nativeNotificationReliability.openNotificationSettings(CHANNEL_ID),
  openExactAlarmSettings: () => nativeNotificationReliability.openExactAlarmSettings(),
  openFullScreenIntentSettings: () => nativeNotificationReliability.openFullScreenIntentSettings(),
  openBatterySettings: () => nativeNotificationReliability.openBatterySettings(),
};
