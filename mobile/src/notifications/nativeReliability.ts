import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type NativeReliabilityModule = {
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
  openNotificationSettings(channelId: string): Promise<void>;
  openBatterySettings(): Promise<void>;
};

const nativeModule = requireOptionalNativeModule<NativeReliabilityModule>('SuisuiNotificationReliability');

export type ExactAlarmCapability = 'available' | 'unavailable' | 'not-applicable' | 'unknown';

export const nativeNotificationReliability = {
  async exactAlarmCapability(): Promise<ExactAlarmCapability> {
    if (Platform.OS !== 'android') return 'not-applicable';
    if (!nativeModule) return 'unknown';
    return (await nativeModule.canScheduleExactAlarms()) ? 'available' : 'unavailable';
  },
  async openExactAlarmSettings(): Promise<void> {
    if (Platform.OS !== 'android' || !nativeModule) {
      throw new Error('当前安装包不支持打开精确提醒设置，请更新安装包。');
    }
    await nativeModule.openExactAlarmSettings();
  },
  async openNotificationSettings(channelId: string): Promise<void> {
    if (Platform.OS !== 'android' || !nativeModule) {
      throw new Error('当前安装包不支持打开通知渠道设置，请更新安装包。');
    }
    await nativeModule.openNotificationSettings(channelId);
  },
  async openBatterySettings(): Promise<void> {
    if (Platform.OS !== 'android' || !nativeModule) {
      throw new Error('当前安装包不支持打开电池设置，请更新安装包。');
    }
    await nativeModule.openBatterySettings();
  },
};
