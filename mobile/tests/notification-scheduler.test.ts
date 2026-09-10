import * as Notifications from 'expo-notifications';
import { notificationScheduler } from '../src/notifications/scheduler';

test('重排时只取消岁岁日历自己的旧通知，并写入可识别的通知数据', async () => {
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
    { identifier: 'owned', content: { data: { owner: 'suisui-calendar' } } },
    { identifier: 'other', content: { data: { owner: 'another-feature' } } },
  ]);
  const reminder = {
    identifier: 'suisui-birthday-a-2026-09-10',
    kind: 'birthday' as const,
    itemId: 'a',
    date: '2026-09-10',
    triggerAt: Date.parse('2026-09-10T09:00:00+08:00'),
    title: '今天是妈妈的生日',
    body: '阳历9月10日 · 记得送上一句祝福。',
  };

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
