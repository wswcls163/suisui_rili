import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { lunarCalendar } from '../core/calendar';
import { systemClock, type Clock } from '../core/clock';
import {
  buildNotificationPlan,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '../core/notification';
import { notificationPreferences, type NotificationPreferences } from '../notifications/preferences';
import {
  notificationScheduler,
  type NotificationDiagnostics,
  type NotificationScheduler,
} from '../notifications/scheduler';
import { useBirthdays } from './AppProvider';

export type NotificationStatus =
  'loading' | 'disabled' | 'scheduling' | 'ready' | 'denied' | 'unsupported' | 'error';

type NotificationContextValue = {
  settings: NotificationSettings;
  status: NotificationStatus;
  scheduledCount: number;
  error: string;
  supported: boolean;
  diagnostics: NotificationDiagnostics;
  testing: boolean;
  testMessage: string;
  setEnabled(enabled: boolean): Promise<void>;
  setFullScreenEnabled(enabled: boolean): Promise<void>;
  setTime(hour: number, minute: number): Promise<void>;
  refreshDiagnostics(): Promise<void>;
  sendImmediateTestNotification(): Promise<void>;
  scheduleDelayedTestNotification(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openExactAlarmSettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
};

const EMPTY_DIAGNOSTICS: NotificationDiagnostics = {
  permission: 'undetermined',
  appNotificationsEnabled: false,
  exactAlarm: 'unknown',
  fullScreen: 'unknown',
  channel: 'missing',
  channelImportance: null,
  soundEnabled: null,
  vibrationEnabled: null,
  floatingBanner: 'manual-check',
  scheduledCount: 0,
  registeredCount: 0,
  lastTestScheduledAt: 0,
  lastTestTriggerAt: 0,
  lastDeliveryAt: 0,
  lastDeliveryIdentifier: '',
};

const fallback: NotificationContextValue = {
  settings: { ...DEFAULT_NOTIFICATION_SETTINGS },
  status: 'disabled',
  scheduledCount: 0,
  error: '',
  supported: false,
  diagnostics: { ...EMPTY_DIAGNOSTICS },
  testing: false,
  testMessage: '',
  setEnabled: async () => {},
  setFullScreenEnabled: async () => {},
  setTime: async () => {},
  refreshDiagnostics: async () => {},
  sendImmediateTestNotification: async () => {},
  scheduleDelayedTestNotification: async () => {},
  openNotificationSettings: async () => {},
  openExactAlarmSettings: async () => {},
  openFullScreenIntentSettings: async () => {},
  openBatterySettings: async () => {},
};

const NotificationContext = createContext<NotificationContextValue>(fallback);

export function NotificationProvider({
  children,
  preferences = notificationPreferences,
  scheduler = notificationScheduler,
  clock = systemClock,
}: {
  children: React.ReactNode;
  preferences?: NotificationPreferences;
  scheduler?: NotificationScheduler;
  clock?: Clock;
}) {
  const app = useBirthdays();
  const [settings, setSettings] = useState<NotificationSettings>({ ...DEFAULT_NOTIFICATION_SETTINGS });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<NotificationStatus>('loading');
  const [scheduledCount, setScheduledCount] = useState(0);
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics>({ ...EMPTY_DIAGNOSTICS });
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [error, setError] = useState('');
  const [resumeRevision, setResumeRevision] = useState(0);
  const runId = useRef(0);

  const refreshDiagnostics = useCallback(async () => {
    if (!scheduler.supported) {
      setDiagnostics({
        permission: 'granted',
        appNotificationsEnabled: true,
        exactAlarm: 'not-applicable',
        fullScreen: 'not-applicable',
        channel: 'not-applicable',
        channelImportance: null,
        soundEnabled: null,
        vibrationEnabled: null,
        floatingBanner: 'not-applicable',
        scheduledCount: 0,
        registeredCount: 0,
        lastTestScheduledAt: 0,
        lastTestTriggerAt: 0,
        lastDeliveryAt: 0,
        lastDeliveryIdentifier: '',
      });
      return;
    }
    setDiagnostics(await scheduler.getDiagnostics());
  }, [scheduler]);

  useEffect(() => {
    let active = true;
    void preferences
      .load()
      .then((value) => {
        if (!active) return;
        setSettings(value);
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : '无法读取提醒设置');
        setStatus('error');
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [preferences]);

  useEffect(() => {
    if (!loaded) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshDiagnostics().catch(() => {});
        setResumeRevision((value) => value + 1);
      }
    });
    return () => subscription.remove();
  }, [loaded, refreshDiagnostics]);

  useEffect(() => {
    if (!loaded || app.status !== 'ready') return;
    const current = ++runId.current;
    const apply = async () => {
      if (!settings.enabled) {
        setStatus('scheduling');
        await scheduler.clear();
        if (current === runId.current) {
          setError('');
          setScheduledCount(0);
          setStatus('disabled');
          void refreshDiagnostics().catch(() => {});
        }
        return;
      }
      const plan = buildNotificationPlan({
        calendar: lunarCalendar,
        people: app.people,
        countups: app.countups,
        now: clock.now(),
        settings,
      });
      if (!scheduler.supported) {
        if (current === runId.current) {
          setError('');
          setScheduledCount(plan.length);
          setStatus('unsupported');
          void refreshDiagnostics().catch(() => {});
        }
        return;
      }
      setStatus('scheduling');
      if ((await scheduler.getPermission()) !== 'granted') {
        if (current === runId.current) {
          setError('');
          setScheduledCount(0);
          setStatus('denied');
          void refreshDiagnostics().catch(() => {});
        }
        return;
      }
      const count = await scheduler.replace(plan, settings.fullScreenEnabled);
      if (current === runId.current) {
        setError('');
        setScheduledCount(count);
        setStatus('ready');
        void refreshDiagnostics().catch(() => {});
      }
    };
    void apply().catch((reason: unknown) => {
      if (current !== runId.current) return;
      setError(reason instanceof Error ? reason.message : '系统提醒更新失败，请稍后重试');
      setStatus('error');
    });
  }, [
    app.countups,
    app.people,
    app.status,
    clock,
    loaded,
    refreshDiagnostics,
    resumeRevision,
    scheduler,
    settings,
  ]);

  const persist = useCallback(
    async (next: NotificationSettings) => {
      await preferences.save(next);
      setSettings(next);
    },
    [preferences],
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      setError('');
      setStatus('scheduling');
      try {
        if (enabled && scheduler.supported && (await scheduler.ensurePermission()) !== 'granted') {
          setStatus('denied');
          setError('系统通知权限未开启，请在手机设置中允许岁岁日历发送通知。');
          void refreshDiagnostics().catch(() => {});
          return;
        }
        await persist({ ...settings, enabled });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '提醒设置保存失败，请重试');
        setStatus('error');
      }
    },
    [persist, refreshDiagnostics, scheduler, settings],
  );

  const setFullScreenEnabled = useCallback(
    async (enabled: boolean) => {
      setError('');
      try {
        await persist({ ...settings, fullScreenEnabled: enabled });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '锁屏全屏设置保存失败，请重试');
        setStatus('error');
      }
    },
    [persist, settings],
  );

  const sendImmediateTestNotification = useCallback(async () => {
    setTesting(true);
    setTestMessage('');
    setError('');
    try {
      if (!scheduler.supported) {
        setTestMessage('电脑预览不会发送系统通知，请在安装新版本后用手机测试。');
        return;
      }
      if ((await scheduler.ensurePermission()) !== 'granted') {
        setStatus('denied');
        setError('系统通知权限未开启，请先进入通知设置允许提醒。');
        return;
      }
      const identifier = await scheduler.sendImmediateTest();
      setTestMessage(
        `测试横幅已交给系统，标识符：${identifier}。若没有弹出，请点击“系统通知与横幅设置”，勾选“横幅”后再试。`,
      );
      await refreshDiagnostics();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '测试横幅发送失败，请重试');
    } finally {
      setTesting(false);
    }
  }, [refreshDiagnostics, scheduler]);

  const scheduleDelayedTestNotification = useCallback(async () => {
    setTesting(true);
    setTestMessage('');
    setError('');
    try {
      if (!scheduler.supported) {
        setTestMessage('电脑预览不会发送系统通知，请在安装新版本后用手机测试。');
        return;
      }
      if (!settings.fullScreenEnabled) {
        setError('请先明确开启“锁屏时全屏提醒”，再安排锁屏测试。');
        return;
      }
      if ((await scheduler.ensurePermission()) !== 'granted') {
        setStatus('denied');
        setError('系统通知权限未开启，请先进入通知设置允许提醒。');
        return;
      }
      const result = await scheduler.scheduleDelayedTest(60, true);
      const expected = new Date(result.triggerAt).toLocaleTimeString('zh-CN', { hour12: false });
      setTestMessage(
        `原生任务已登记，预计 ${expected} 触发；标识符：${result.identifier}。现在可返回桌面并锁屏；部分厂商系统划掉最近任务会取消提醒。`,
      );
      await refreshDiagnostics();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '锁屏测试安排失败，请重试');
    } finally {
      setTesting(false);
    }
  }, [refreshDiagnostics, scheduler, settings.fullScreenEnabled]);

  const runSettingsAction = useCallback(async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法打开系统设置');
    }
  }, []);

  const openNotificationSettings = useCallback(
    () => runSettingsAction(scheduler.openNotificationSettings),
    [runSettingsAction, scheduler],
  );
  const openExactAlarmSettings = useCallback(
    () => runSettingsAction(scheduler.openExactAlarmSettings),
    [runSettingsAction, scheduler],
  );
  const openFullScreenIntentSettings = useCallback(
    () => runSettingsAction(scheduler.openFullScreenIntentSettings),
    [runSettingsAction, scheduler],
  );
  const openBatterySettings = useCallback(
    () => runSettingsAction(scheduler.openBatterySettings),
    [runSettingsAction, scheduler],
  );

  const setTime = useCallback(
    async (hour: number, minute: number) => {
      try {
        await persist({ ...settings, hour, minute });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '提醒时间保存失败，请重试');
        setStatus('error');
      }
    },
    [persist, settings],
  );

  const value = useMemo(
    () => ({
      settings,
      status,
      scheduledCount,
      error,
      supported: scheduler.supported,
      diagnostics,
      testing,
      testMessage,
      setEnabled,
      setFullScreenEnabled,
      setTime,
      refreshDiagnostics,
      sendImmediateTestNotification,
      scheduleDelayedTestNotification,
      openNotificationSettings,
      openExactAlarmSettings,
      openFullScreenIntentSettings,
      openBatterySettings,
    }),
    [
      diagnostics,
      error,
      openBatterySettings,
      openExactAlarmSettings,
      openFullScreenIntentSettings,
      openNotificationSettings,
      refreshDiagnostics,
      scheduleDelayedTestNotification,
      sendImmediateTestNotification,
      scheduledCount,
      scheduler.supported,
      setEnabled,
      setFullScreenEnabled,
      setTime,
      settings,
      status,
      testMessage,
      testing,
    ],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}
