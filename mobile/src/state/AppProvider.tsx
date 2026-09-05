import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  type Birthday,
  type BirthdayDraft,
  type BirthdayRepository,
  birthdayRows,
  birthdayTitle,
  requireBirthdayType,
} from '../core/birthday';
import {
  type Countup,
  type CountupDraft,
  type CountupRepository,
  countupProgress,
  normalizeCountupDraft,
} from '../core/countup';
import { lunarCalendar } from '../core/calendar';
import { clampDate, dateInMonth, monthStart, requireSupported, todayInBeijing } from '../core/dates';
import { systemClock, TodayWatcher, type Clock } from '../core/clock';
import { repository } from '../data/repository';
import { useAccountSync } from './SyncProvider';

export type AppRepository = BirthdayRepository & CountupRepository;

function useAppState(repo: AppRepository, clock: Clock, syncRevision: number, scheduleSync: () => void) {
  const [people, setPeople] = useState<Birthday[]>([]);
  const [countups, setCountups] = useState<Countup[]>([]);
  const [today, setToday] = useState(() => todayInBeijing(clock.now()));
  const [selectedDate, setSelectedDate] = useState(() => clampDate(today));
  const [month, setMonth] = useState(() => monthStart(clampDate(today)));
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const request = useRef({ id: 0 });
  const refreshToday = useCallback(() => setToday(todayInBeijing(clock.now())), [clock]);
  const load = useCallback(
    (_scopeRevision?: number) => {
      const current = ++request.current.id;
      return repo
        .initialize()
        .then(() => Promise.all([repo.list(), repo.listCountups()]))
        .then(([records, countupRecords]) => {
          if (current === request.current.id) {
            setPeople(records);
            setCountups(countupRecords);
            setStatus('ready');
          }
        })
        .catch((err: unknown) => {
          if (current === request.current.id) {
            setError(err instanceof Error ? err.message : '无法读取事项，请重试');
            setStatus('error');
          }
        });
    },
    [repo],
  );
  const reload = useCallback(async () => {
    setStatus('loading');
    setError('');
    await load();
  }, [load]);
  useEffect(() => {
    const token = request.current;
    void load(syncRevision);
    return () => {
      token.id++;
    };
  }, [load, syncRevision]);
  useEffect(() => {
    const watcher = new TodayWatcher(setToday, clock);
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') watcher.start();
    const subscription = AppState.addEventListener('change', (state) =>
      state === 'active' ? watcher.start() : watcher.stop(),
    );
    return () => {
      watcher.stop();
      subscription.remove();
    };
  }, [clock]);
  const save = useCallback(
    async (draft: BirthdayDraft, id?: string, type = 'birthday') => {
      requireBirthdayType(type);
      if (writing.current) throw new Error('正在保存，请稍候');
      if (status !== 'ready') throw new Error('数据尚未就绪，请稍后重试');
      writing.current = true;
      setBusy(true);
      try {
        const row = id ? await repo.update(id, draft) : await repo.create(draft);
        setPeople((current) => (id ? current.map((p) => (p.id === id ? row : p)) : [...current, row]));
        refreshToday();
        setNotice(`已保存「${birthdayTitle(row.name)}」`);
        scheduleSync();
      } finally {
        writing.current = false;
        setBusy(false);
      }
    },
    [repo, refreshToday, scheduleSync, status],
  );
  const remove = useCallback(
    async (id: string) => {
      if (writing.current) throw new Error('正在处理，请稍候');
      writing.current = true;
      setBusy(true);
      try {
        await repo.remove(id);
        setPeople((current) => current.filter((p) => p.id !== id));
        refreshToday();
        setNotice('生日已删除');
        scheduleSync();
      } finally {
        writing.current = false;
        setBusy(false);
      }
    },
    [repo, refreshToday, scheduleSync],
  );
  const saveCountup = useCallback(
    async (input: CountupDraft, id?: string) => {
      if (writing.current) throw new Error('正在保存，请稍候');
      if (status !== 'ready') throw new Error('数据尚未就绪，请稍后重试');
      const draft = normalizeCountupDraft(input);
      writing.current = true;
      setBusy(true);
      try {
        const row = id ? await repo.updateCountup(id, draft) : await repo.createCountup(draft);
        setCountups((current) =>
          id ? current.map((item) => (item.id === id ? row : item)) : [...current, row],
        );
        refreshToday();
        setNotice(`已保存「${row.title}」累计日`);
        scheduleSync();
      } finally {
        writing.current = false;
        setBusy(false);
      }
    },
    [repo, refreshToday, scheduleSync, status],
  );
  const removeCountup = useCallback(
    async (id: string) => {
      if (writing.current) throw new Error('正在处理，请稍候');
      writing.current = true;
      setBusy(true);
      try {
        await repo.removeCountup(id);
        setCountups((current) => current.filter((item) => item.id !== id));
        refreshToday();
        setNotice('累计日已删除');
        scheduleSync();
      } finally {
        writing.current = false;
        setBusy(false);
      }
    },
    [repo, refreshToday, scheduleSync],
  );
  const selectDate = useCallback((date: string) => {
    requireSupported(date);
    setSelectedDate(date);
    setMonth(monthStart(date));
  }, []);
  const viewMonth = useCallback((date: string) => {
    requireSupported(date);
    const next = monthStart(date);
    setMonth(next);
    setSelectedDate((selected) => dateInMonth(selected, next));
  }, []);
  const rows = useMemo(() => birthdayRows(lunarCalendar, people, today), [people, today]);
  const todayRows = useMemo(() => rows.filter((row) => row.remaining === 0), [rows]);
  const countupRows = useMemo(
    () =>
      countups
        .map((item) => ({ item, progress: countupProgress(item.startDate, today) }))
        .sort((a, b) =>
          a.progress.phase === b.progress.phase
            ? b.item.createdAt.localeCompare(a.item.createdAt) || a.item.id.localeCompare(b.item.id)
            : a.progress.phase === 'active'
              ? -1
              : 1,
        ),
    [countups, today],
  );
  return {
    people,
    countups,
    today,
    selectedDate,
    month,
    status,
    error,
    notice,
    setNotice,
    busy,
    rows,
    todayRows,
    countupRows,
    reload,
    save,
    remove,
    saveCountup,
    removeCountup,
    selectDate,
    viewMonth,
    refreshToday,
  };
}
type AppContextValue = ReturnType<typeof useAppState>;
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({
  children,
  repo = repository,
  clock = systemClock,
}: {
  children: React.ReactNode;
  repo?: AppRepository;
  clock?: Clock;
}) {
  const sync = useAccountSync();
  const state = useAppState(repo, clock, sync.revision, sync.schedule);
  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}
export function useBirthdays(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('生日状态尚未初始化');
  return value;
}
