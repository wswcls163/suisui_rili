import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { BirthdayRepository } from '../core/birthday';
import { repository as defaultRepository } from '../data/repository';
import { SyncCoordinator } from '../sync/coordinator';
import {
  accountOwner,
  GUEST_OWNER,
  isSyncBirthdayRepository,
  type RemoteBirthdayGateway,
  type SyncConflict,
} from '../sync/model';
import { remoteGateway as defaultGateway } from '../sync/remote';
import { useAuth } from './AuthProvider';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error' | 'conflict' | 'unavailable';

type SyncContextValue = {
  ownerKey: string;
  status: SyncStatus;
  error: string;
  pendingCount: number;
  guestCount: number;
  conflicts: SyncConflict[];
  revision: number;
  lastSyncedAt: string | null;
  syncNow(): Promise<void>;
  schedule(): void;
  importGuest(): Promise<void>;
  resolveConflict(birthdayId: string, choice: 'local' | 'remote'): Promise<void>;
  signOut(force?: boolean): Promise<void>;
  deleteAccount(): Promise<void>;
};

const fallback: SyncContextValue = {
  ownerKey: GUEST_OWNER,
  status: 'local',
  error: '',
  pendingCount: 0,
  guestCount: 0,
  conflicts: [],
  revision: 0,
  lastSyncedAt: null,
  syncNow: async () => {},
  schedule: () => {},
  importGuest: async () => {},
  resolveConflict: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
};

const SyncContext = createContext<SyncContextValue>(fallback);

export function SyncProvider({
  children,
  repo = defaultRepository,
  gateway = defaultGateway,
}: {
  children: React.ReactNode;
  repo?: BirthdayRepository;
  gateway?: RemoteBirthdayGateway | null;
}) {
  const auth = useAuth();
  const local = isSyncBirthdayRepository(repo) ? repo : null;
  const coordinator = useMemo(
    () => (local && gateway ? new SyncCoordinator(local, gateway) : null),
    [gateway, local],
  );
  const [ownerKey, setOwnerKey] = useState(GUEST_OWNER);
  const ownerRef = useRef(GUEST_OWNER);
  const [status, setStatus] = useState<SyncStatus>('local');
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [guestCount, setGuestCount] = useState(0);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [revision, setRevision] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const retryAttempt = useRef(0);
  const ownerSwitches = useRef<Promise<void>>(Promise.resolve());

  const refreshMeta = useCallback(async () => {
    if (!local) return { pending: 0, conflicts: 0 };
    const [pending, guests, conflictRows] = await Promise.all([
      local.pending(),
      local.guestCount(),
      local.conflicts(),
    ]);
    setPendingCount(pending.length);
    setGuestCount(guests);
    setConflicts(conflictRows);
    if (conflictRows.length) setStatus('conflict');
    return { pending: pending.length, conflicts: conflictRows.length };
  }, [local]);

  const syncFor = useCallback(
    async (target: string) => {
      if (!local || !coordinator || !auth.session) {
        await refreshMeta();
        setStatus(auth.session ? 'unavailable' : 'local');
        return;
      }
      setStatus('syncing');
      setError('');
      try {
        await coordinator.sync(target);
        const meta = await refreshMeta();
        retryAttempt.current = 0;
        setLastSyncedAt(new Date().toISOString());
        setStatus(meta.conflicts ? 'conflict' : 'synced');
        setRevision((value) => value + 1);
      } catch (reason) {
        retryAttempt.current++;
        setError(reason instanceof Error ? reason.message : '暂时无法同步，请稍后重试');
        setStatus('error');
        await refreshMeta();
        throw reason;
      }
    },
    [auth.session, coordinator, local, refreshMeta],
  );

  useEffect(() => {
    if (!local) return;
    let active = true;
    const nextOwner = auth.session ? accountOwner(auth.session.userId) : GUEST_OWNER;
    const switchOwner = ownerSwitches.current.then(async () => {
      if (!active) return false;
      await local.setOwner(nextOwner);
      if (!active) return false;
      ownerRef.current = nextOwner;
      setOwnerKey(nextOwner);
      setRevision((value) => value + 1);
      await refreshMeta();
      return active;
    });
    ownerSwitches.current = switchOwner.then(
      () => undefined,
      () => undefined,
    );
    void switchOwner
      .then(async (switched) => {
        if (!switched || !active) return;
        if (auth.session) await syncFor(nextOwner).catch(() => {});
        else setStatus('local');
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : '无法切换账号数据');
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [auth.session, local, refreshMeta, syncFor]);

  useEffect(() => {
    if (!auth.session) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncFor(ownerRef.current).catch(() => {});
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void syncFor(ownerRef.current).catch(() => {});
    }, 5 * 60_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [auth.session, syncFor]);

  useEffect(() => {
    if (!auth.session || status !== 'error') return;
    const delay = Math.min(60_000, 5_000 * 2 ** Math.min(retryAttempt.current - 1, 4));
    const timer = setTimeout(() => {
      if (AppState.currentState === 'active') void syncFor(ownerRef.current).catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [auth.session, status, error, syncFor]);

  const value = useMemo<SyncContextValue>(
    () => ({
      ownerKey,
      status,
      error,
      pendingCount,
      guestCount,
      conflicts,
      revision,
      lastSyncedAt,
      async syncNow() {
        await syncFor(ownerRef.current);
      },
      schedule() {
        if (auth.session) void syncFor(ownerRef.current).catch(() => {});
        else void refreshMeta();
      },
      async importGuest() {
        if (!local || !auth.session) throw new Error('请先登录再合并本机生日');
        await local.importGuest();
        setRevision((current) => current + 1);
        await syncFor(ownerRef.current);
        const [pending, conflictRows] = await Promise.all([local.pending(), local.conflicts()]);
        if (!pending.length && !conflictRows.length) await local.clearGuest();
        await refreshMeta();
      },
      async resolveConflict(birthdayId, choice) {
        if (!local) return;
        await local.resolveConflict(birthdayId, choice);
        setRevision((current) => current + 1);
        await syncFor(ownerRef.current);
      },
      async signOut(force = false) {
        if (!local || !auth.session) return auth.signOut();
        if (!force) {
          await syncFor(ownerRef.current);
          if ((await local.pending()).length || (await local.conflicts()).length)
            throw new Error('还有未同步的修改，请重试同步或确认放弃后退出');
        }
        const previousOwner = ownerRef.current;
        await auth.signOut();
        await local.clearOwner(previousOwner);
      },
      async deleteAccount() {
        if (!local || !auth.session) return auth.deleteAccount();
        const previousOwner = ownerRef.current;
        await auth.deleteAccount();
        await local.clearOwner(previousOwner);
      },
    }),
    [
      auth,
      conflicts,
      error,
      guestCount,
      lastSyncedAt,
      local,
      ownerKey,
      pendingCount,
      refreshMeta,
      revision,
      status,
      syncFor,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useAccountSync(): SyncContextValue {
  return useContext(SyncContext);
}
