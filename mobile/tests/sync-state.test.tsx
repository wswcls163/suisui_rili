import 'fake-indexeddb/auto';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Dexie } from 'dexie';
import type { AuthService } from '../src/auth/auth';
import { WebBirthdayRepository } from '../src/data/web';
import { AuthProvider } from '../src/state/AuthProvider';
import { SyncProvider, useAccountSync } from '../src/state/SyncProvider';
import type { RemoteBirthday, RemoteBirthdayGateway, SyncMutation } from '../src/sync/model';

test('登录后切换账号数据范围，访客生日确认上传后才清理', async () => {
  const name = `suisui-sync-state-${Date.now()}`;
  let sequence = 0;
  const repo = new WebBirthdayRepository(name, () => `state-${++sequence}`);
  await repo.create({ name: '妈妈', lunar: { month: 1, day: 1, isLeap: false }, solar: null });
  const session = { userId: 'account', email: 'user@example.com' };
  const service: AuthService = {
    getSession: jest.fn(async () => session),
    subscribe: jest.fn(() => jest.fn()),
    signUp: jest.fn(),
    signIn: jest.fn(),
    requestPasswordReset: jest.fn(),
    updatePassword: jest.fn(),
    handleCallback: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
  const remote = new Map<string, RemoteBirthday>();
  const gateway: RemoteBirthdayGateway = {
    list: jest.fn(async () => [...remote.values()]),
    apply: jest.fn(async (mutation: SyncMutation) => {
      const record = {
        ...mutation.payload!,
        version: mutation.baseVersion + 1,
        deletedAt: null,
      };
      remote.set(record.id, record);
      return { status: 'applied' as const, record };
    }),
  };
  const { result, unmount } = renderHook(useAccountSync, {
    wrapper: ({ children }) => (
      <AuthProvider service={service}>
        <SyncProvider repo={repo} gateway={gateway}>
          {children}
        </SyncProvider>
      </AuthProvider>
    ),
  });
  try {
    await waitFor(() => expect(result.current.ownerKey).toBe('user:account'));
    await waitFor(() => expect(result.current.status).toBe('synced'));
    expect(result.current.guestCount).toBe(1);
    await act(() => result.current.importGuest());
    expect(result.current.guestCount).toBe(0);
    expect(result.current.pendingCount).toBe(0);
    expect(remote.size).toBe(1);
  } finally {
    unmount();
    await repo.close();
    await Dexie.delete(name);
  }
});
