import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { lunarCalendar } from '../core/calendar';
import { systemClock, type Clock } from '../core/clock';
import {
  buildNotificationPlan,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '../core/notification';
import { notificationPreferences, type NotificationPreferences } from '../notifications/preferences';
import { notificationScheduler, type NotificationScheduler } from '../notifications/scheduler';
import { useBirthdays } from './AppProvider';

export type NotificationStatus =
  'loading' | 'disabled' | 'scheduling' | 'ready' | 'denied' | 'unsupported' | 'error';

type NotificationContextValue = {
  settings: NotificationSettings;
  status: NotificationStatus;
  scheduledCount: number;
  error: string;
  supported: boolean;
  setEnabled(enabled: boolean): Promise<void>;
  setTime(hour: number, minute: number): Promise<void>;
};

const fallback: NotificationContextValue = {
  settings: { ...DEFAULT_NOTIFICATION_SETTINGS },
  status: 'disabled',
  scheduledCount: 0,
  error: '',
  supported: false,
  setEnabled: async () => {},
  setTime: async () => {},
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
  const [error, setError] = useState('');
  const runId = useRef(0);

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
        }
        return;
      }
      setStatus('scheduling');
      if ((await scheduler.getPermission()) !== 'granted') {
        if (current === runId.current) {
          setError('');
          setScheduledCount(0);
          setStatus('denied');
        }
        return;
      }
      const count = await scheduler.replace(plan);
      if (current === runId.current) {
        setError('');
        setScheduledCount(count);
        setStatus('ready');
      }
    };
    void apply().catch((reason: unknown) => {
      if (current !== runId.current) return;
      setError(reason instanceof Error ? reason.message : '系统提醒更新失败，请稍后重试');
      setStatus('error');
    });
  }, [app.countups, app.people, app.status, clock, loaded, scheduler, settings]);

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
          return;
        }
        await persist({ ...settings, enabled });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '提醒设置保存失败，请重试');
        setStatus('error');
      }
    },
    [persist, scheduler, settings],
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
      setEnabled,
      setTime,
    }),
    [error, scheduledCount, scheduler.supported, setEnabled, setTime, settings, status],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}
