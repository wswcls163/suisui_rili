import type { NotificationScheduler } from './scheduler';

export const notificationScheduler: NotificationScheduler = {
  supported: false,
  getPermission: async () => 'granted',
  ensurePermission: async () => 'granted',
  replace: async (reminders) => reminders.length,
  clear: async () => {},
};
