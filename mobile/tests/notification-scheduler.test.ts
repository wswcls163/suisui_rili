import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { nativeNotificationReliability } from '../src/notifications/nativeReliability';
import { CHANNEL_ID, notificationScheduler } from '../src/notifications/scheduler';

const reminder = {
  identifier: 'suisui-birthday-a-2026-09-10',
  kind: 'birthday' as const,
  itemId: 'a',
  date: '2026-09-10',
  triggerAt: Date.parse('2026-09-10T09:00:00+08:00'),
  title: '今天是妈妈的生日',
  body: '阳历9月10日 · 记得送上一句祝福。',
};

function scheduledOwned(identifier = reminder.identifier) {
  return [{ identifier, content: { data: { owner: 'suisui-calendar' } } }];
}

beforeEach(() => {
  jest.clearAllMocks();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    status: 'granted',
  });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    status: 'granted',
  });
  (Notifications.getNotificationChannelAsync as jest.Mock).mockResolvedValue({
    id: CHANNEL_ID,
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  });
  (nativeNotificationReliability.exactAlarmCapability as jest.Mock).mockResolvedValue('available');
});

test('重排时只取消自己的旧通知，写入新渠道并核对系统实际保存结果', async () => {
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock)
    .mockResolvedValueOnce([
      { identifier: 'owned', content: { data: { owner: 'suisui-calendar' } } },
      { identifier: 'other', content: { data: { owner: 'another-feature' } } },
    ])
    .mockResolvedValueOnce(scheduledOwned());

  await expect(notificationScheduler.replace([reminder])).resolves.toBe(1);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('owned');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: reminder.identifier,
      content: expect.objectContaining({
        title: reminder.title,
        data: expect.objectContaining({ owner: 'suisui-calendar', itemId: 'a' }),
      }),
      trigger: expect.objectContaining({ type: 'date', date: reminder.triggerAt }),
    }),
  );
});

test('连续重排会先取消上一批确定性标识，不留下重复提醒', async () => {
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(scheduledOwned())
    .mockResolvedValueOnce(scheduledOwned())
    .mockResolvedValueOnce(scheduledOwned());

  await notificationScheduler.replace([reminder]);
  await notificationScheduler.replace([reminder]);

  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(reminder.identifier);
});

test('系统未保存完整计划时明确失败，不把调用成功误报为排程成功', async () => {
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);

  await expect(notificationScheduler.replace([reminder])).rejects.toThrow('0/1');
});

test('Android 诊断能识别精确闹钟未授权和被降级的旧渠道', async () => {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  try {
    (nativeNotificationReliability.exactAlarmCapability as jest.Mock).mockResolvedValueOnce('unavailable');
    (Notifications.getNotificationChannelAsync as jest.Mock).mockResolvedValueOnce({
      id: CHANNEL_ID,
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      enableVibrate: false,
    });
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce(scheduledOwned());

    await expect(notificationScheduler.getDiagnostics()).resolves.toEqual({
      permission: 'granted',
      exactAlarm: 'unavailable',
      channel: 'low-priority',
      scheduledCount: 1,
    });
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.objectContaining({
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
      }),
    );
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  }
});

test('通知权限被拒绝时不安排测试通知', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
    granted: false,
    status: 'denied',
  });

  await expect(notificationScheduler.scheduleTest()).rejects.toThrow('请先允许');
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('1 分钟测试通知使用独立所有者并在重复测试前取消旧任务', async () => {
  await expect(notificationScheduler.scheduleTest()).resolves.toBe('suisui-notification-test');
  await expect(notificationScheduler.scheduleTest()).resolves.toBe('suisui-notification-test');

  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('suisui-notification-test');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({
      identifier: 'suisui-notification-test',
      content: expect.objectContaining({
        title: '岁岁日历测试通知',
        data: { owner: 'suisui-calendar-diagnostic', kind: 'diagnostic' },
      }),
      trigger: expect.objectContaining({ type: 'timeInterval', seconds: 60, repeats: false }),
    }),
  );
});
