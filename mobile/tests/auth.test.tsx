import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { AccountScreen } from '../src/components/AccountScreen';
import {
  friendlyAuthError,
  markAuthCallbackUrl,
  normalizeEmail,
  parseAuthCallbackUrl,
  requirePassword,
  type AccountSession,
  type AuthCallbackKind,
  type AuthService,
} from '../src/auth/auth';
import { AuthProvider, useAuth } from '../src/state/AuthProvider';
import { sessionStorage } from '../src/auth/session-storage';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));

function authService(initial: { userId: string; email: string } | null = null) {
  let listener: (session: { userId: string; email: string } | null) => void = () => {};
  const service: jest.Mocked<AuthService> = {
    getSession: jest.fn(async () => initial),
    subscribe: jest.fn((next) => {
      listener = next;
      return jest.fn();
    }),
    signUp: jest.fn(
      async (_email: string, _password: string): Promise<{ session: AccountSession | null }> => ({
        session: null,
      }),
    ),
    signIn: jest.fn(async (email: string, _password: string) => ({ userId: 'user-1', email })),
    requestPasswordReset: jest.fn(async (_email: string) => {}),
    updatePassword: jest.fn(async (_password: string) => {}),
    handleCallback: jest.fn(
      async (_url: string): Promise<{ kind: AuthCallbackKind; session: AccountSession }> => ({
        kind: 'confirmed',
        session: { userId: 'user-1', email: 'user@example.com' },
      }),
    ),
    signOut: jest.fn(async () => listener(null)),
    deleteAccount: jest.fn(async () => listener(null)),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
  return service;
}

test('邮箱和密码在进入服务前完成基础校验，常见服务错误转换为中文', () => {
  expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
  expect(() => normalizeEmail('not-an-email')).toThrow('有效的邮箱');
  expect(() => requirePassword('1234567')).toThrow('至少需要 8');
  expect(() => requirePassword('x'.repeat(73))).toThrow('不能超过 72');
  expect(friendlyAuthError({ code: 'invalid_credentials' }).message).toBe('邮箱或密码不正确');
  expect(friendlyAuthError(new TypeError('Failed to fetch')).message).toBe(
    '网络暂时不可用，请检查连接后重试',
  );
});

test('邮箱回调只接受当前应用的 PKCE 地址和授权码，拒绝外部地址及明文令牌', () => {
  expect(
    parseAuthCallbackUrl('suisui://auth/callback?code=verified-code&type=recovery', 'suisui://auth/callback'),
  ).toEqual({ code: 'verified-code', kind: 'recovery' });
  expect(
    parseAuthCallbackUrl(
      'https://calendar.example/auth/callback/?code=verified-code',
      'https://calendar.example/auth/callback',
    ),
  ).toEqual({ code: 'verified-code', kind: 'confirmed' });
  expect(() =>
    parseAuthCallbackUrl(
      'https://attacker.example/auth/callback?code=attacker-code',
      'https://calendar.example/auth/callback',
    ),
  ).toThrow('无效或已经过期');
  expect(() =>
    parseAuthCallbackUrl(
      'suisui://auth/callback#access_token=attacker&refresh_token=attacker',
      'suisui://auth/callback',
    ),
  ).toThrow('无效或已经过期');
  expect(() =>
    parseAuthCallbackUrl('suisui://auth/callback-extra?code=code', 'suisui://auth/callback'),
  ).toThrow('无效或已经过期');
});

test('密码重置回调携带恢复标记，普通邮箱确认不携带', () => {
  expect(new URL(markAuthCallbackUrl('suisui://auth/callback', 'recovery')).searchParams.get('type')).toBe(
    'recovery',
  );
  expect(markAuthCallbackUrl('suisui://auth/callback')).toBe('suisui://auth/callback');
});

test('原生会话存储可以完整读写和删除超过单项限制的令牌', async () => {
  const value = 'token'.repeat(1200);
  await sessionStorage.setItem('session', value);
  expect(await sessionStorage.getItem('session')).toBe(value);
  await sessionStorage.removeItem('session');
  expect(await sessionStorage.getItem('session')).toBeNull();
});

test('原生会话存储拒绝异常分片数量，避免损坏数据造成大量读写', async () => {
  await SecureStore.setItemAsync('damaged.parts', '999999999');
  expect(await sessionStorage.getItem('damaged')).toBeNull();
  await sessionStorage.removeItem('damaged');
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('damaged.0');
});

test('过大的新会话被拒绝时仍保留原有有效会话', async () => {
  await sessionStorage.setItem('oversized', 'previous-session');
  await expect(sessionStorage.setItem('oversized', 'x'.repeat(1800 * 65))).rejects.toThrow('无法安全保存');
  expect(await sessionStorage.getItem('oversized')).toBe('previous-session');
  await sessionStorage.removeItem('oversized');
});

test('账号状态初始化、注册、登录与退出由 AuthProvider 统一管理', async () => {
  const service = authService();
  const { result } = renderHook(useAuth, {
    wrapper: ({ children }) => <AuthProvider service={service}>{children}</AuthProvider>,
  });
  await waitFor(() => expect(result.current.status).toBe('guest'));
  await act(async () => {
    await expect(result.current.signUp('a@example.com', '12345678', 'not-same')).rejects.toThrow(
      '两次输入的密码不一致',
    );
  });
  expect(service.signUp).not.toHaveBeenCalled();

  await act(() => result.current.signUp(' New@Example.COM ', '12345678', '12345678'));
  expect(service.signUp).toHaveBeenCalledWith('new@example.com', '12345678');
  expect(result.current.notice).toContain('验证邮件已发送');

  await act(() => result.current.signIn(' User@Example.COM ', '12345678'));
  expect(result.current.session).toEqual({ userId: 'user-1', email: 'user@example.com' });
  expect(result.current.status).toBe('authenticated');
  await act(() => result.current.signOut());
  expect(result.current.session).toBeNull();
  expect(result.current.status).toBe('guest');
});

test('密码重置深链接优先于旧会话恢复，并进入设置新密码状态', async () => {
  const initialUrl = jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValueOnce('suisui://auth/callback?code=reset&type=recovery');
  const service = authService();
  service.handleCallback.mockResolvedValueOnce({
    kind: 'recovery',
    session: { userId: 'user-1', email: 'user@example.com' },
  });
  const { result } = renderHook(useAuth, {
    wrapper: ({ children }) => <AuthProvider service={service}>{children}</AuthProvider>,
  });
  await waitFor(() => expect(result.current.status).toBe('recovery'));
  expect(service.getSession).not.toHaveBeenCalled();
  expect(result.current.notice).toBe('请设置新的登录密码');
  act(() => {
    service.subscribe.mock.calls[0][0]({ userId: 'user-1', email: 'user@example.com' });
  });
  expect(result.current.status).toBe('recovery');
  initialUrl.mockRestore();
});

test('未配置账号服务时说明本机仍可使用', () => {
  render(
    <AuthProvider service={null}>
      <AccountScreen />
    </AuthProvider>,
  );
  expect(screen.getByText('账号服务尚未配置')).toBeTruthy();
  expect(screen.getByText('当前生日仍会安全地保存在这台设备上。')).toBeTruthy();
});

test('重要日期提醒作为独立侧边栏页面，不混入账号内容', () => {
  render(
    <AuthProvider service={null}>
      <AccountScreen section="notifications" />
    </AuthProvider>,
  );
  expect(screen.getByRole('header', { name: '重要日期提醒' })).toBeTruthy();
  expect(screen.getByText('节日与节气')).toBeTruthy();
  expect(screen.getByText('当天 09:00 · 重叠合并')).toBeTruthy();
  expect(screen.getByText('提醒目前已关闭。开启后会弹出系统授权，点击“允许”后自动生效。')).toBeTruthy();
  expect(screen.getByRole('button', { name: '打开功能菜单' })).toBeTruthy();
  expect(screen.queryByText('账号服务尚未配置')).toBeNull();
});

test('登录页提交邮箱密码，并能切换到注册和找回密码', async () => {
  const service = authService();
  render(
    <AuthProvider service={service}>
      <AccountScreen />
    </AuthProvider>,
  );
  await screen.findByText('登录岁岁日历');
  fireEvent.changeText(screen.getByLabelText('邮箱'), ' User@Example.COM ');
  fireEvent.changeText(screen.getByLabelText('密码'), '12345678');
  fireEvent.press(screen.getByRole('button', { name: '登录' }));
  await waitFor(() => expect(service.signIn).toHaveBeenCalledWith('user@example.com', '12345678'));

  service.getSession.mockResolvedValue(null);
  const second = render(
    <AuthProvider service={service}>
      <AccountScreen />
    </AuthProvider>,
  );
  await screen.findAllByText('登录岁岁日历');
  fireEvent.press(screen.getAllByRole('button', { name: '注册账号' }).at(-1)!);
  expect(screen.getByText('创建账号')).toBeTruthy();
  expect(screen.getByLabelText('再次输入密码')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '返回登录' }));
  fireEvent.press(screen.getByRole('button', { name: '忘记密码' }));
  expect(screen.getByText('找回密码')).toBeTruthy();
  second.unmount();
});
