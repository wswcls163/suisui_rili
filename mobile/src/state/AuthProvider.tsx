import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import {
  friendlyAuthError,
  normalizeEmail,
  requirePassword,
  type AccountSession,
  type AuthService,
} from '../auth/auth';
import { authService as defaultService } from '../auth/client';

type AuthStatus = 'unconfigured' | 'loading' | 'guest' | 'authenticated' | 'recovery';

type AuthContextValue = {
  status: AuthStatus;
  session: AccountSession | null;
  busy: boolean;
  error: string;
  notice: string;
  signUp(email: string, password: string, confirmation: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string, confirmation: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  clearMessages(): void;
};

const unavailable = async () => {
  throw new Error('账号服务尚未配置');
};

const fallback: AuthContextValue = {
  status: 'unconfigured',
  session: null,
  busy: false,
  error: '',
  notice: '',
  signUp: unavailable,
  signIn: unavailable,
  requestPasswordReset: unavailable,
  updatePassword: unavailable,
  signOut: unavailable,
  deleteAccount: unavailable,
  clearMessages: () => {},
};

const AuthContext = createContext<AuthContextValue>(fallback);

export function AuthProvider({
  children,
  service = defaultService,
}: {
  children: React.ReactNode;
  service?: AuthService | null;
}) {
  const [status, setStatus] = useState<AuthStatus>(service ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<AccountSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const acceptSession = useCallback((next: AccountSession | null) => {
    setSession(next);
    setStatus((current) => (next ? (current === 'recovery' ? 'recovery' : 'authenticated') : 'guest'));
  }, []);

  const handleCallback = useCallback(
    async (url: string) => {
      if (!service || !url.includes('auth/callback')) return;
      setBusy(true);
      setError('');
      try {
        const result = await service.handleCallback(url);
        setSession(result.session);
        setStatus(result.kind === 'recovery' ? 'recovery' : 'authenticated');
        setNotice(result.kind === 'recovery' ? '请设置新的登录密码' : '邮箱验证成功，账号已经登录');
      } catch (reason) {
        setError(friendlyAuthError(reason).message);
        setStatus((current) => (current === 'loading' ? 'guest' : current));
      } finally {
        setBusy(false);
      }
    },
    [service],
  );

  useEffect(() => {
    if (!service) return;
    let active = true;
    const unsubscribe = service.subscribe((next) => active && acceptSession(next));
    void Linking.getInitialURL()
      .then(async (url) => {
        if (!active) return;
        if (url?.includes('auth/callback')) await handleCallback(url);
        else acceptSession(await service.getSession());
      })
      .catch((reason) => {
        if (!active) return;
        setError(friendlyAuthError(reason).message);
        setStatus('guest');
      });
    const link = Linking.addEventListener('url', ({ url }) => void handleCallback(url));
    return () => {
      active = false;
      unsubscribe();
      link.remove();
    };
  }, [acceptSession, handleCallback, service]);

  useEffect(() => {
    if (!service) return;
    if (AppState.currentState === 'active') service.startAutoRefresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') service.startAutoRefresh();
      else service.stopAutoRefresh();
    });
    return () => {
      service.stopAutoRefresh();
      subscription.remove();
    };
  }, [service]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (reason) {
      const next = friendlyAuthError(reason);
      setError(next.message);
      throw next;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      busy,
      error,
      notice,
      async signUp(email, password, confirmation) {
        await run(async () => {
          if (!service) return unavailable();
          const normalized = normalizeEmail(email);
          const validPassword = requirePassword(password);
          if (password !== confirmation) throw new Error('两次输入的密码不一致');
          const result = await service.signUp(normalized, validPassword);
          if (result.session) acceptSession(result.session);
          else setStatus('guest');
          setNotice(result.session ? '账号创建成功，已经登录' : '验证邮件已发送，请打开邮件完成验证');
        });
      },
      async signIn(email, password) {
        await run(async () => {
          if (!service) return unavailable();
          acceptSession(await service.signIn(normalizeEmail(email), requirePassword(password)));
          setNotice('登录成功');
        });
      },
      async requestPasswordReset(email) {
        await run(async () => {
          if (!service) return unavailable();
          await service.requestPasswordReset(normalizeEmail(email));
          setNotice('如果邮箱已经注册，将会收到密码重置邮件');
        });
      },
      async updatePassword(password, confirmation) {
        await run(async () => {
          if (!service) return unavailable();
          const validPassword = requirePassword(password);
          if (password !== confirmation) throw new Error('两次输入的密码不一致');
          await service.updatePassword(validPassword);
          setStatus('authenticated');
          setNotice('密码已经更新');
        });
      },
      async signOut() {
        await run(async () => {
          if (!service) return unavailable();
          await service.signOut();
          acceptSession(null);
        });
      },
      async deleteAccount() {
        await run(async () => {
          if (!service) return unavailable();
          await service.deleteAccount();
          acceptSession(null);
        });
      },
      clearMessages() {
        setError('');
        setNotice('');
      },
    }),
    [acceptSession, busy, error, notice, run, service, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
