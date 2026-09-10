import { normalizeNotificationSettings, type NotificationSettings } from '../core/notification';
import type { NotificationPreferences } from './preferences';

const SETTINGS_KEY = 'suisui-notification-settings-v1';

export const notificationPreferences: NotificationPreferences = {
  async load() {
    try {
      const value = globalThis.localStorage?.getItem(SETTINGS_KEY);
      return normalizeNotificationSettings(value ? JSON.parse(value) : null);
    } catch {
      return normalizeNotificationSettings(null);
    }
  },
  async save(settings: NotificationSettings) {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};
