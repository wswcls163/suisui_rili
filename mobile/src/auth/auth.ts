export type AccountSession = { userId: string; email: string };
export type AuthCallbackKind = 'confirmed' | 'recovery';

export function markAuthCallbackUrl(url: string, kind?: AuthCallbackKind): string {
  if (kind !== 'recovery') return url;
  const value = new URL(url);
  value.searchParams.set('type', 'recovery');
  return value.toString();
}

function callbackPath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function parseAuthCallbackUrl(
  url: string,
  expectedUrl: string,
): { code: string; kind: AuthCallbackKind } {
  let actual: URL;
  let expected: URL;
  try {
    actual = new URL(url);
    expected = new URL(expectedUrl);
  } catch {
    throw new Error('邮箱链接无效或已经过期');
  }
  const sameTarget =
    actual.protocol === expected.protocol &&
    actual.hostname === expected.hostname &&
    actual.port === expected.port &&
    actual.username === expected.username &&
    actual.password === expected.password &&
    callbackPath(actual.pathname) === callbackPath(expected.pathname);
  const code = actual.searchParams.get('code');
  if (!sameTarget || !code) throw new Error('邮箱链接无效或已经过期');
  const type = actual.searchParams.get('type');
  return { code, kind: type === 'recovery' ? 'recovery' : 'confirmed' };
}

export interface AuthService {
  getSession(): Promise<AccountSession | null>;
  subscribe(listener: (session: AccountSession | null) => void): () => void;
  signUp(email: string, password: string): Promise<{ session: AccountSession | null }>;
  signIn(email: string, password: string): Promise<AccountSession>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  handleCallback(url: string): Promise<{ kind: AuthCallbackKind; session: AccountSession }>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请输入有效的邮箱地址');
  return email;
}

export function requirePassword(value: string): string {
  if (value.length < 8) throw new Error('密码至少需要 8 个字符');
  if (value.length > 72) throw new Error('密码不能超过 72 个字符');
  return value;
}

export function friendlyAuthError(error: unknown): Error {
  const source = error as { code?: string; message?: string } | null;
  const code = source?.code ?? '';
  const message = source?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message))
    return new Error('邮箱或密码不正确');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message))
    return new Error('请先打开验证邮件完成邮箱验证');
  if (code === 'user_already_exists' || /already registered|already exists/i.test(message))
    return new Error('这个邮箱已经注册，可以直接登录');
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message))
    return new Error('邮件发送过于频繁，请稍后再试');
  if (/network|fetch|socket/i.test(message)) return new Error('网络暂时不可用，请检查连接后重试');
  return new Error(message || '账号服务暂时不可用，请稍后重试');
}
