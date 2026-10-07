import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { nativeNotificationReliability } from '../src/notifications/nativeReliability';
import { notificationScheduler } from '../src/notifications/scheduler';

const reminder = {
  identifier: 'suisui-festival-2026-09-18',
  kind: 'festival' as const,
  itemId: '2026-09-18',
  date: '2026-09-18',
  triggerAt: Date.parse('2026-09-18T09:00:00+08:00'),
  title: '今天是九一八事变纪念日',
  body: '日历上的重要日子，愿今天有值得记住的时刻。',
};

const originalOS = Platform.OS;

function setOS(value: 'android' | 'ios') {
  Object.defineProperty(Platform, 'OS', { configurable: true, value });
}

beforeEach(() => {
  jest.clearAllMocks();
  setOS('android');
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    status: 'granted',
  });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    status: 'granted',
  });
  (nativeNotificationReliability.replace as jest.Mock).mockImplementation(
    async (reminders: { identifier: string }[]) => ({
      expectedCount: reminders.length,
      registeredCount: reminders.length,
      identifiers: reminders.map((value) => value.identifier),
    }),
  );
  (nativeNotificationReliability.diagnostics as jest.Mock).mockResolvedValue({
    appNotificationsEnabled: true,
    exactAlarmAvailable: true,
    fullScreenIntentAvailable: true,
    channelExists: true,
    channelImportance: 4,
    channelSoundEnabled: false,
    channelVibrationEnabled: false,
    channelLockscreenVisibility: 1,
    scheduledCount: 1,
    registeredCount: 1,
    registeredIdentifiers: [reminder.identifier],
    lastTestScheduledAt: 0,
    lastTestTriggerAt: 0,
    lastDeliveryAt: 0,
    lastDeliveryIdentifier: '',
  });
});

afterAll(() => setOS(originalOS === 'android' ? 'android' : 'ios'));

test('Android 的九一八等生产提醒全部走原生可靠排程并回读标识符', async () => {
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
    { identifier: 'old-production', content: { data: { owner: 'suisui-calendar' } } },
    {
      identifier: 'suisui-notification-test',
      content: { data: { owner: 'suisui-calendar-diagnostic' } },
    },
  ]);
  await expect(notificationScheduler.replace([reminder], true)).resolves.toBe(1);
  expect(nativeNotificationReliability.replace).toHaveBeenCalledWith([reminder], true);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-production');
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('suisui-notification-test');
});

test('原生登记数量或标识符不完整时明确失败，不能误报成功', async () => {
  (nativeNotificationReliability.replace as jest.Mock).mockResolvedValueOnce({
    expectedCount: 1,
    registeredCount: 0,
    identifiers: [],
  });
  await expect(notificationScheduler.replace([reminder])).rejects.toThrow('0/1');
});

test('Android 诊断把声音和振动分别作为信息，不把静默高优先级渠道判成错误', async () => {
  await expect(notificationScheduler.getDiagnostics()).resolves.toMatchObject({
    permission: 'granted',
    appNotificationsEnabled: true,
    exactAlarm: 'available',
    fullScreen: 'available',
    channel: 'ready',
    channelImportance: 4,
    soundEnabled: false,
    vibrationEnabled: false,
    floatingBanner: 'manual-check',
  });
  expect(nativeNotificationReliability.ensureChannel).toHaveBeenCalled();
});

test('通知权限被拒绝时既不立即投递也不登记延时测试', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: false,
    status: 'denied',
  });
  await expect(notificationScheduler.sendImmediateTest()).rejects.toThrow('请先允许');
  await expect(notificationScheduler.scheduleDelayedTest()).rejects.toThrow('请先允许');
  expect(nativeNotificationReliability.sendImmediateTest).not.toHaveBeenCalled();
  expect(nativeNotificationReliability.scheduleDelayedTest).not.toHaveBeenCalled();
});

test('立即测试直接调用原生投递并要求明确的投递结果', async () => {
  (nativeNotificationReliability.sendImmediateTest as jest.Mock).mockResolvedValueOnce({
    identifier: 'suisui-native-immediate-test',
    delivered: true,
    deliveredAt: 123,
  });
  await expect(notificationScheduler.sendImmediateTest()).resolves.toBe('suisui-native-immediate-test');
});

test('1 分钟测试用固定标识原生登记并回读预计触发时间', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  (nativeNotificationReliability.scheduleDelayedTest as jest.Mock).mockResolvedValueOnce({
    identifier: 'suisui-native-delayed-test',
    registered: true,
    triggerAt: 1_060_000,
  });
  try {
    await expect(notificationScheduler.scheduleDelayedTest(60, true)).resolves.toEqual({
      identifier: 'suisui-native-delayed-test',
      triggerAt: 1_060_000,
    });
    expect(nativeNotificationReliability.scheduleDelayedTest).toHaveBeenCalledWith(1_060_000, true);
  } finally {
    now.mockRestore();
  }
});

test('iOS 延时测试也必须从系统排程回读，不能只凭 API 未抛错', async () => {
  setOS('ios');
  (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('suisui-notification-test');
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
    {
      identifier: 'suisui-notification-test',
      content: { data: { owner: 'suisui-calendar-diagnostic' } },
    },
  ]);
  await expect(notificationScheduler.scheduleDelayedTest(60, false)).resolves.toMatchObject({
    identifier: 'suisui-notification-test',
  });
});

test('通知设置打开应用级通知与横幅页面', async () => {
  await notificationScheduler.openNotificationSettings();
  expect(nativeNotificationReliability.openNotificationSettings).toHaveBeenCalledWith();
});
