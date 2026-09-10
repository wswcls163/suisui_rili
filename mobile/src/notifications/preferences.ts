import * as SecureStore from 'expo-secure-store';
import { normalizeNotificationSettings, type NotificationSettings } from '../core/notification';

const SETTINGS_KEY = 'suisui-notification-settings-v1';

export interface NotificationPreferences {
  load(): Promise<NotificationSettings>;
  save(settings: NotificationSettings): Promise<void>;
}

export const notificationPreferences: NotificationPreferences = {
  async load() {
    const value = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!value) return normalizeNotificationSettings(null);
    try {
      return normalizeNotificationSettings(JSON.parse(value));
    } catch {
      return normalizeNotificationSettings(null);
    }
  },
  async save(settings) {
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
  },
};
