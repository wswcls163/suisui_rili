import type { NotificationScheduler } from './scheduler';

export const notificationScheduler: NotificationScheduler = {
  supported: false,
  getPermission: async () => 'granted',
  ensurePermission: async () => 'granted',
  getDiagnostics: async () => ({
    permission: 'granted',
    exactAlarm: 'not-applicable',
    channel: 'not-applicable',
    scheduledCount: 0,
  }),
  replace: async (reminders) => reminders.length,
  clear: async () => {},
  scheduleTest: async () => 'web-preview',
  openNotificationSettings: async () => {},
  openExactAlarmSettings: async () => {},
  openBatterySettings: async () => {},
};
