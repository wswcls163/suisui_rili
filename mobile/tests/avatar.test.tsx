import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { AccountSession, AuthService } from '../src/auth/auth';
import {
  AVATAR_SIZE,
  avatarInitial,
  avatarLocalRef,
  avatarRemotePath,
  validAvatarMetadata,
  type AvatarImageProcessor,
  type AvatarMetadata,
  type AvatarMetadataStore,
  type AvatarPrivateStore,
  type AvatarRemoteGateway,
  type ProcessedAvatar,
} from '../src/avatar/model';
import { avatarCrop, avatarPickerOptions, avatarSaveOptions } from '../src/avatar/processor';
import { AccountScreen } from '../src/components/AccountScreen';
import Home from '../app/index';
import { AppProvider } from '../src/state/AppProvider';
import { AuthProvider } from '../src/state/AuthProvider';
import { AvatarProvider, useAccountAvatar } from '../src/state/AvatarProvider';
import { memoryRepository } from './helpers';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));

const userA = { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'alice@example.com' };
const userB = { userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'bob@example.com' };
const bytesA = new Uint8Array([1, 2, 3]);
const bytesB = new Uint8Array([4, 5, 6]);

function authService(initial: AccountSession | null = userA) {
  let listener: (session: AccountSession | null) => void = () => {};
  const service: jest.Mocked<AuthService> & { emit(session: AccountSession | null): void } = {
    getSession: jest.fn(async () => initial),
    subscribe: jest.fn((next) => {
      listener = next;
      return jest.fn();
    }),
    signUp: jest.fn(async (_email: string, _password: string) => ({ session: null })),
    signIn: jest.fn(async (_email: string, _password: string) => userA),
    requestPasswordReset: jest.fn(async (_email: string) => {}),
    updatePassword: jest.fn(async (_password: string) => {}),
    handleCallback: jest.fn(async (_url: string) => ({ kind: 'confirmed' as const, session: userA })),
    signOut: jest.fn(async () => listener(null)),
    deleteAccount: jest.fn(async () => listener(null)),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
    emit(session) {
      listener(session);
    },
  };
  return service;
}

function memoryMetadata(): AvatarMetadataStore & { rows: Map<string, AvatarMetadata> } {
  const rows = new Map<string, AvatarMetadata>();
  return {
    rows,
    load: jest.fn(async (ownerKey) => rows.get(ownerKey) ?? null),
    save: jest.fn(async (metadata) => void rows.set(metadata.ownerKey, { ...metadata })),
    remove: jest.fn(async (ownerKey) => void rows.delete(ownerKey)),
  };
}

function memoryPrivate(): AvatarPrivateStore & { rows: Map<string, Uint8Array> } {
  const rows = new Map<string, Uint8Array>();
  return {
    rows,
    persist: jest.fn(async (ownerKey, avatar) => {
      const localRef = `${ownerKey.slice(5)}-${avatar.hash.slice(0, 16)}.jpg`;
      rows.set(localRef, Uint8Array.from(avatar.bytes));
      return { localRef, displayUri: `private://${localRef}` };
    }),
    resolve: jest.fn(async (localRef) => (rows.has(localRef) ? `private://${localRef}` : null)),
    read: jest.fn(async (localRef) => rows.get(localRef) ?? null),
    remove: jest.fn(async (localRef) => void rows.delete(localRef)),
  };
}

function remoteGateway(): AvatarRemoteGateway & { rows: Map<string, Uint8Array> } {
  const rows = new Map<string, Uint8Array>();
  return {
    rows,
    download: jest.fn(async (ownerKey) => rows.get(ownerKey) ?? null),
    upload: jest.fn(async (ownerKey, bytes) => void rows.set(ownerKey, Uint8Array.from(bytes))),
    remove: jest.fn(async (ownerKey) => void rows.delete(ownerKey)),
  };
}

function avatar(bytes = bytesA, hash = 'a'.repeat(64)): ProcessedAvatar {
  return { bytes, hash, width: AVATAR_SIZE, height: AVATAR_SIZE, mimeType: 'image/jpeg' };
}

function avatarHarness(options?: {
  service?: ReturnType<typeof authService>;
  metadata?: ReturnType<typeof memoryMetadata>;
  privateStore?: ReturnType<typeof memoryPrivate>;
  processor?: jest.Mocked<AvatarImageProcessor>;
  gateway?: ReturnType<typeof remoteGateway> | null;
}) {
  const service = options?.service ?? authService();
  const metadata = options?.metadata ?? memoryMetadata();
  const privateStore = options?.privateStore ?? memoryPrivate();
  const processor = options?.processor ?? { pick: jest.fn(async () => avatar()) };
  const gateway = options?.gateway === undefined ? remoteGateway() : options.gateway;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider service={service}>
      <AvatarProvider
        metadataStore={metadata}
        privateStore={privateStore}
        processor={processor}
        gateway={gateway}
        hashBytes={async (bytes) => (bytes[0] === 4 ? 'b'.repeat(64) : 'a'.repeat(64))}
      >
        {children}
      </AvatarProvider>
    </AuthProvider>
  );
  return { service, metadata, privateStore, processor, gateway, wrapper };
}

test('头像规则生成固定私有路径、邮箱回退首字母和居中方形裁剪', () => {
  expect(avatarRemotePath(`user:${userA.userId}`)).toBe(`${userA.userId}/avatar.jpg`);
  expect(() => avatarRemotePath('guest')).toThrow('账号范围无效');
  expect(avatarInitial(' alice@example.com')).toBe('A');
  expect(avatarInitial(undefined)).toBe('');
  expect(avatarCrop(1200, 800)).toEqual({ originX: 200, originY: 0, width: 800, height: 800 });
  expect(avatarCrop(600, 900)).toEqual({ originX: 0, originY: 150, width: 600, height: 600 });
  expect(avatarPickerOptions).toEqual(
    expect.objectContaining({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      exif: false,
      base64: false,
      allowsMultipleSelection: false,
    }),
  );
  expect(avatarSaveOptions).toEqual({ base64: false, compress: 0.82, format: 'jpeg' });
  const ownerKey = `user:${userA.userId}`;
  const hash = 'a'.repeat(64);
  const metadata: AvatarMetadata = {
    ownerKey,
    localRef: avatarLocalRef(ownerKey, hash),
    hash,
    remotePath: avatarRemotePath(ownerKey),
    updatedAt: '2026-10-10T00:00:00.000Z',
    syncState: 'synced',
  };
  expect(validAvatarMetadata(metadata, ownerKey)).toBe(true);
  expect(validAvatarMetadata({ ...metadata, ownerKey: `user:${userB.userId}` }, ownerKey)).toBe(false);
  expect(validAvatarMetadata({ ...metadata, remotePath: `${userB.userId}/avatar.jpg` }, ownerKey)).toBe(
    false,
  );
  expect(
    validAvatarMetadata({ ...metadata, localRef: avatarLocalRef(`user:${userB.userId}`, hash) }, ownerKey),
  ).toBe(false);
});

test('选择成功立即显示并上传；取消不改变头像；替换清理旧私有文件', async () => {
  const processor: jest.Mocked<AvatarImageProcessor> = {
    pick: jest
      .fn<ReturnType<AvatarImageProcessor['pick']>, Parameters<AvatarImageProcessor['pick']>>()
      .mockResolvedValueOnce(avatar())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(avatar(bytesB, 'b'.repeat(64))),
  };
  const harness = avatarHarness({ processor });
  const { result } = renderHook(useAccountAvatar, { wrapper: harness.wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));

  await act(() => result.current.chooseAvatar());
  expect(result.current.uri).toContain('aaaaaaaaaaaaaaaa');
  expect(result.current.syncState).toBe('synced');
  expect(harness.gateway?.upload).toHaveBeenCalledWith(`user:${userA.userId}`, bytesA);
  const firstUri = result.current.uri;

  await act(() => result.current.chooseAvatar());
  expect(result.current.uri).toBe(firstUri);

  await act(() => result.current.chooseAvatar());
  expect(result.current.uri).toContain('bbbbbbbbbbbbbbbb');
  expect(harness.privateStore.remove).toHaveBeenCalledWith(expect.stringContaining('aaaaaaaaaaaaaaaa'));
});

test('选择处理失败保留现有头像并显示错误', async () => {
  const processor: jest.Mocked<AvatarImageProcessor> = {
    pick: jest.fn().mockResolvedValueOnce(avatar()).mockRejectedValueOnce(new Error('图片无法处理')),
  };
  const harness = avatarHarness({ processor });
  const { result } = renderHook(useAccountAvatar, { wrapper: harness.wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(() => result.current.chooseAvatar());
  const previous = result.current.uri;
  await act(async () => {
    await expect(result.current.chooseAvatar()).rejects.toThrow('图片无法处理');
  });
  expect(result.current.uri).toBe(previous);
  expect(result.current.error).toBe('图片无法处理');
});

test('应用重启从私有缓存恢复，另一台设备通过认证下载得到同一头像', async () => {
  const metadata = memoryMetadata();
  const firstPrivate = memoryPrivate();
  const gateway = remoteGateway();
  const first = avatarHarness({ metadata, privateStore: firstPrivate, gateway });
  const view = renderHook(useAccountAvatar, { wrapper: first.wrapper });
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  await act(() => view.result.current.chooseAvatar());
  view.unmount();

  const restart = avatarHarness({ metadata, privateStore: firstPrivate, gateway });
  const restarted = renderHook(useAccountAvatar, { wrapper: restart.wrapper });
  await waitFor(() => expect(restarted.result.current.uri).toContain('aaaaaaaaaaaaaaaa'));

  const secondPrivate = memoryPrivate();
  const second = avatarHarness({ metadata: memoryMetadata(), privateStore: secondPrivate, gateway });
  const otherDevice = renderHook(useAccountAvatar, { wrapper: second.wrapper });
  await waitFor(() => expect(otherDevice.result.current.uri).toContain('aaaaaaaaaaaaaaaa'));
  expect(secondPrivate.persist).toHaveBeenCalledWith(
    `user:${userA.userId}`,
    expect.objectContaining({ width: 512, height: 512, mimeType: 'image/jpeg' }),
  );
});

test('离线上传失败保留本机头像和待同步状态，手动重试后成功', async () => {
  const harness = avatarHarness();
  const gateway = harness.gateway!;
  (gateway.upload as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const { result } = renderHook(useAccountAvatar, { wrapper: harness.wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(() => result.current.chooseAvatar());
  expect(result.current.uri).toContain('aaaaaaaaaaaaaaaa');
  expect(result.current.status).toBe('pending');
  expect(result.current.error).toContain('头像已保存在本机');
  expect(harness.metadata.rows.get(`user:${userA.userId}`)?.syncState).toBe('pending-upload');
  await act(() => result.current.retry());
  expect(result.current.status).toBe('ready');
  expect(result.current.syncState).toBe('synced');
});

test('删除先恢复邮箱首字母，云端失败保留待删除任务并可重试', async () => {
  const harness = avatarHarness();
  const gateway = harness.gateway!;
  const { result } = renderHook(useAccountAvatar, { wrapper: harness.wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(() => result.current.chooseAvatar());
  (gateway.remove as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await act(() => result.current.deleteAvatar());
  expect(result.current.uri).toBeNull();
  expect(result.current.status).toBe('pending');
  expect(harness.metadata.rows.get(`user:${userA.userId}`)?.syncState).toBe('pending-delete');
  await act(() => result.current.retry());
  expect(result.current.status).toBe('ready');
  expect(harness.metadata.rows.has(`user:${userA.userId}`)).toBe(false);
});

test('账号 A、账号 B 与退出登录之间不会串用头像', async () => {
  const service = authService(userA);
  const gateway = remoteGateway();
  gateway.rows.set(`user:${userA.userId}`, bytesA);
  gateway.rows.set(`user:${userB.userId}`, bytesB);
  const harness = avatarHarness({ service, gateway });
  const { result } = renderHook(useAccountAvatar, { wrapper: harness.wrapper });
  await waitFor(() => expect(result.current.uri).toContain('aaaaaaaaaaaaaaaa'));
  act(() => service.emit(userB));
  expect(result.current.uri).toBeNull();
  await waitFor(() => expect(result.current.uri).toContain('bbbbbbbbbbbbbbbb'));
  act(() => service.emit(null));
  await waitFor(() => expect(result.current.status).toBe('guest'));
  expect(result.current.uri).toBeNull();
});

test('账号切换时迟到的旧账号读取结果不会覆盖新账号头像', async () => {
  const service = authService(userA);
  let finishA!: (bytes: Uint8Array | null) => void;
  const gateway = remoteGateway();
  (gateway.download as jest.Mock).mockImplementation((ownerKey: string) => {
    if (ownerKey === `user:${userA.userId}`)
      return new Promise<Uint8Array | null>((resolve) => {
        finishA = resolve;
      });
    return Promise.resolve(bytesB);
  });
  const harness = avatarHarness({ service, gateway });
  const { result } = renderHook(useAccountAvatar, { wrapper: harness.wrapper });
  await waitFor(() => expect(result.current.status).toBe('syncing'));
  act(() => service.emit(userB));
  await waitFor(() => expect(result.current.uri).toContain('bbbbbbbbbbbbbbbb'));
  await act(async () => finishA(bytesA));
  expect(result.current.uri).toContain('bbbbbbbbbbbbbbbb');
});

test('注销清理入口删除当前账号的私有文件和元数据', async () => {
  const harness = avatarHarness();
  const { result } = renderHook(useAccountAvatar, { wrapper: harness.wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(() => result.current.chooseAvatar());
  const localRef = harness.metadata.rows.get(`user:${userA.userId}`)?.localRef;
  expect(localRef).toBeTruthy();
  await act(() => result.current.clearLocalOwner(`user:${userA.userId}`));
  expect(harness.metadata.rows.has(`user:${userA.userId}`)).toBe(false);
  expect(harness.privateStore.rows.has(localRef!)).toBe(false);
  expect(result.current.uri).toBeNull();
});

function AvatarControl() {
  const avatarState = useAccountAvatar();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="测试选择头像"
      onPress={() => void avatarState.chooseAvatar()}
    >
      <Text>测试选择头像</Text>
    </Pressable>
  );
}

test('首页与账号页共享即时头像，账号页确认删除后同时恢复邮箱首字母', async () => {
  const harness = avatarHarness({ gateway: null });
  render(
    <harness.wrapper>
      <AppProvider repo={memoryRepository()} clock={{ now: () => Date.parse('2026-09-04T04:00:00Z') }}>
        <AvatarControl />
        <Home />
        <AccountScreen />
      </AppProvider>
    </harness.wrapper>,
  );
  await screen.findByText(userA.email);
  expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(2);
  fireEvent.press(screen.getByRole('button', { name: '测试选择头像' }));
  await waitFor(() => expect(screen.getAllByLabelText('账号头像照片')).toHaveLength(2));
  fireEvent.press(screen.getByRole('button', { name: '删除头像' }));
  expect(screen.getByText('将删除本机和云端头像，首页会恢复显示邮箱首字母。')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '确认删除头像' }));
  await waitFor(() => expect(screen.queryAllByLabelText('账号头像照片')).toHaveLength(0));
  expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(2);
});
