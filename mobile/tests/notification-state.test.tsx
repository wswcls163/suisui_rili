import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { NotificationSettings } from '../src/core/notification';
import type { NotificationPreferences } from '../src/notifications/preferences';
import type { NotificationScheduler } from '../src/notifications/scheduler';
import { AppProvider } from '../src/state/AppProvider';
import { NotificationProvider, useNotifications } from '../src/state/NotificationProvider';
import { countupFixture, fixture, memoryRepository } from './helpers';

const now = Date.parse('2026-09-09T12:00:00+08:00');
const clock = { now: () => now };

const readyDiagnostics = {
  permission: 'granted' as const,
  exactAlarm: 'available' as const,
  channel: 'ready' as const,
  scheduledCount: 60,
};

function schedulerMethods() {
  return {
    getDiagnostics: jest.fn(async () => readyDiagnostics),
    scheduleTest: jest.fn(async () => 'suisui-notification-test'),
    openNotificationSettings: jest.fn(async () => {}),
    openExactAlarmSettings: jest.fn(async () => {}),
    openBatterySettings: jest.fn(async () => {}),
  };
}

test('开启后保存本机设置并按数据变化重排节日、生日和周年通知', async () => {
  let stored: NotificationSettings = { enabled: false, hour: 9, minute: 0 };
  const preferences: NotificationPreferences = {
    load: jest.fn(async () => stored),
    save: jest.fn(async (settings) => {
      stored = settings;
    }),
  };
  const scheduler: NotificationScheduler = {
    supported: true,
    getPermission: jest.fn(async () => 'granted'),
    ensurePermission: jest.fn(async () => 'granted'),
    replace: jest.fn(async (reminders) => reminders.length),
    clear: jest.fn(async () => {}),
    ...schedulerMethods(),
  };
  const repo = memoryRepository(
    [fixture('birthday', { lunar: null, solar: { month: 9, day: 10 } })],
    [
      countupFixture('days', { displayMode: 'days' }),
      countupFixture('anniversary', { displayMode: 'anniversary', startDate: '2024-09-10' }),
    ],
  );
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider repo={repo} clock={clock}>
      <NotificationProvider preferences={preferences} scheduler={scheduler} clock={clock}>
        {children}
      </NotificationProvider>
    </AppProvider>
  );
  const { result } = renderHook(useNotifications, { wrapper });

  await waitFor(() => expect(result.current.status).toBe('disabled'));
  expect(scheduler.clear).toHaveBeenCalled();

  await act(() => result.current.setEnabled(true));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(preferences.save).toHaveBeenLastCalledWith({ enabled: true, hour: 9, minute: 0 });
  expect(scheduler.ensurePermission).toHaveBeenCalled();
  expect(scheduler.replace).toHaveBeenLastCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'combined',
        itemId: '2026-09-10',
        date: '2026-09-10',
        title: '今天有多个重要日子',
      }),
    ]),
  );
  const firstPlan = (scheduler.replace as jest.Mock).mock.calls.at(-1)?.[0];
  expect(firstPlan).toHaveLength(60);
  expect(firstPlan.some((item: { itemId: string }) => item.itemId === 'days')).toBe(false);
  const combined = firstPlan.find((item: { date: string }) => item.date === '2026-09-10');
  expect(combined.body).toContain('教师节');
  expect(combined.body).toContain('亲友birthday的生日');
  expect(combined.body).toContain('「时光记录anniversary」2 周年');

  await act(() => result.current.setTime(10, 15));
  await waitFor(() => expect(result.current.settings).toMatchObject({ hour: 10, minute: 15 }));
  await waitFor(() => expect((scheduler.replace as jest.Mock).mock.calls.length).toBeGreaterThan(1));
  const latest = (scheduler.replace as jest.Mock).mock.calls.at(-1)?.[0];
  expect(latest[0].triggerAt).toBe(Date.parse('2026-09-10T10:15:00+08:00'));
});

test('拒绝通知权限时不开启开关并给出可操作提示', async () => {
  const preferences: NotificationPreferences = {
    load: jest.fn(async () => ({ enabled: false, hour: 9, minute: 0 })),
    save: jest.fn(async () => {}),
  };
  const scheduler: NotificationScheduler = {
    supported: true,
    getPermission: jest.fn(async () => 'denied'),
    ensurePermission: jest.fn(async () => 'denied'),
    replace: jest.fn(async () => 0),
    clear: jest.fn(async () => {}),
    ...schedulerMethods(),
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider repo={memoryRepository()} clock={clock}>
      <NotificationProvider preferences={preferences} scheduler={scheduler} clock={clock}>
        {children}
      </NotificationProvider>
    </AppProvider>
  );
  const { result } = renderHook(useNotifications, { wrapper });
  await waitFor(() => expect(result.current.status).toBe('disabled'));

  await act(() => result.current.setEnabled(true));
  expect(result.current.status).toBe('denied');
  expect(result.current.settings.enabled).toBe(false);
  expect(result.current.error).toContain('手机设置');
  expect(preferences.save).not.toHaveBeenCalled();
});

test('精确闹钟不可用时保留已排程提醒并提供诊断，1 分钟测试仍可安排', async () => {
  const preferences: NotificationPreferences = {
    load: jest.fn(async () => ({ enabled: true, hour: 9, minute: 0 })),
    save: jest.fn(async () => {}),
  };
  const scheduler: NotificationScheduler = {
    supported: true,
    getPermission: jest.fn(async () => 'granted'),
    ensurePermission: jest.fn(async () => 'granted'),
    getDiagnostics: jest.fn(async () => ({
      ...readyDiagnostics,
      exactAlarm: 'unavailable' as const,
    })),
    replace: jest.fn(async (reminders) => reminders.length),
    clear: jest.fn(async () => {}),
    scheduleTest: jest.fn(async () => 'suisui-notification-test'),
    openNotificationSettings: jest.fn(async () => {}),
    openExactAlarmSettings: jest.fn(async () => {}),
    openBatterySettings: jest.fn(async () => {}),
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider repo={memoryRepository()} clock={clock}>
      <NotificationProvider preferences={preferences} scheduler={scheduler} clock={clock}>
        {children}
      </NotificationProvider>
    </AppProvider>
  );
  const { result } = renderHook(useNotifications, { wrapper });

  await waitFor(() => expect(result.current.status).toBe('ready'));
  await waitFor(() => expect(result.current.diagnostics.exactAlarm).toBe('unavailable'));
  expect(scheduler.replace).toHaveBeenCalled();

  await act(() => result.current.scheduleTestNotification());
  expect(scheduler.scheduleTest).toHaveBeenCalledWith(60);
  expect(result.current.testMessage).toContain('锁屏');

  await act(() => result.current.openExactAlarmSettings());
  expect(scheduler.openExactAlarmSettings).toHaveBeenCalled();
});

test('从系统设置或后台返回前台时重新诊断并重排，恢复新授予的精确能力', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  const preferences: NotificationPreferences = {
    load: jest.fn(async () => ({ enabled: true, hour: 9, minute: 0 })),
    save: jest.fn(async () => {}),
  };
  const scheduler: NotificationScheduler = {
    supported: true,
    getPermission: jest.fn(async () => 'granted'),
    ensurePermission: jest.fn(async () => 'granted'),
    replace: jest.fn(async (reminders) => reminders.length),
    clear: jest.fn(async () => {}),
    ...schedulerMethods(),
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProvider repo={memoryRepository()} clock={clock}>
      <NotificationProvider preferences={preferences} scheduler={scheduler} clock={clock}>
        {children}
      </NotificationProvider>
    </AppProvider>
  );

  try {
    const { result } = renderHook(useNotifications, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(onAppStateChange).toBeDefined());
    const replaceCount = (scheduler.replace as jest.Mock).mock.calls.length;

    act(() => onAppStateChange?.('active'));

    await waitFor(() =>
      expect((scheduler.replace as jest.Mock).mock.calls.length).toBeGreaterThan(replaceCount),
    );
    expect(scheduler.getDiagnostics).toHaveBeenCalled();
  } finally {
    appStateSpy.mockRestore();
  }
});
