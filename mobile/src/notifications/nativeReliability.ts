import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import type { ScheduledReminder } from '../core/notification';

type NativeReliabilityModule = {
  ensureReliableChannel(): Promise<void>;
  canScheduleExactAlarms(): Promise<boolean>;
  canUseFullScreenIntent(): Promise<boolean>;
  replaceScheduledNotifications(payloadJson: string, fullScreen: boolean): Promise<string>;
  clearScheduledNotifications(): Promise<void>;
  sendImmediateTestNotification(): Promise<string>;
  scheduleDelayedTestNotification(triggerAt: number, fullScreen: boolean): Promise<string>;
  getReliableNotificationDiagnostics(): Promise<string>;
  openExactAlarmSettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  openNotificationSettings(channelId: string): Promise<void>;
  openBatterySettings(): Promise<void>;
};

const nativeModule = requireOptionalNativeModule<NativeReliabilityModule>('SuisuiNotificationReliability');

export type ExactAlarmCapability = 'available' | 'unavailable' | 'not-applicable' | 'unknown';
export type FullScreenCapability = 'available' | 'unavailable' | 'not-applicable' | 'unknown';

export type NativeScheduleResult = {
  expectedCount: number;
  registeredCount: number;
  identifiers: string[];
};

export type NativeImmediateTestResult = {
  identifier: string;
  delivered: boolean;
  deliveredAt: number;
};

export type NativeDelayedTestResult = {
  identifier: string;
  registered: boolean;
  triggerAt: number;
};

export type NativeNotificationDiagnostics = {
  appNotificationsEnabled: boolean;
  exactAlarmAvailable: boolean;
  fullScreenIntentAvailable: boolean;
  channelExists: boolean;
  channelImportance: number;
  channelSoundEnabled: boolean;
  channelVibrationEnabled: boolean;
  channelLockscreenVisibility: number;
  scheduledCount: number;
  registeredCount: number;
  registeredIdentifiers: string[];
  lastTestScheduledAt: number;
  lastTestTriggerAt: number;
  lastDeliveryAt: number;
  lastDeliveryIdentifier: string;
};

function requireAndroidModule(): NativeReliabilityModule {
  if (Platform.OS !== 'android' || !nativeModule) {
    throw new Error('当前安装包不包含 Android 可靠提醒模块，请更新安装包。');
  }
  return nativeModule;
}

function parse<T>(value: string): T {
  return JSON.parse(value) as T;
}

export const nativeNotificationReliability = {
  available: Platform.OS === 'android' && nativeModule !== null,
  async ensureChannel(): Promise<void> {
    await requireAndroidModule().ensureReliableChannel();
  },
  async exactAlarmCapability(): Promise<ExactAlarmCapability> {
    if (Platform.OS !== 'android') return 'not-applicable';
    if (!nativeModule) return 'unknown';
    return (await nativeModule.canScheduleExactAlarms()) ? 'available' : 'unavailable';
  },
  async fullScreenCapability(): Promise<FullScreenCapability> {
    if (Platform.OS !== 'android') return 'not-applicable';
    if (!nativeModule) return 'unknown';
    return (await nativeModule.canUseFullScreenIntent()) ? 'available' : 'unavailable';
  },
  async replace(reminders: ScheduledReminder[], fullScreen: boolean): Promise<NativeScheduleResult> {
    const payload = reminders.map(({ identifier, triggerAt, title, body, kind, itemId, date }) => ({
      identifier,
      triggerAt,
      title,
      body,
      kind,
      itemId,
      date,
    }));
    return parse(
      await requireAndroidModule().replaceScheduledNotifications(JSON.stringify(payload), fullScreen),
    );
  },
  async clear(): Promise<void> {
    await requireAndroidModule().clearScheduledNotifications();
  },
  async sendImmediateTest(): Promise<NativeImmediateTestResult> {
    return parse(await requireAndroidModule().sendImmediateTestNotification());
  },
  async scheduleDelayedTest(triggerAt: number, fullScreen: boolean): Promise<NativeDelayedTestResult> {
    return parse(await requireAndroidModule().scheduleDelayedTestNotification(triggerAt, fullScreen));
  },
  async diagnostics(): Promise<NativeNotificationDiagnostics> {
    return parse(await requireAndroidModule().getReliableNotificationDiagnostics());
  },
  async openExactAlarmSettings(): Promise<void> {
    await requireAndroidModule().openExactAlarmSettings();
  },
  async openFullScreenIntentSettings(): Promise<void> {
    await requireAndroidModule().openFullScreenIntentSettings();
  },
  async openNotificationSettings(channelId: string): Promise<void> {
    await requireAndroidModule().openNotificationSettings(channelId);
  },
  async openBatterySettings(): Promise<void> {
    await requireAndroidModule().openBatterySettings();
  },
};
