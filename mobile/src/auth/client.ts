import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AccountSession, AuthCallbackKind, AuthService } from './auth';
import { sessionStorage } from './session-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const accountConfigured = Boolean(supabaseUrl && publishableKey);

export const supabaseClient: SupabaseClient | null = accountConfigured
  ? createClient(supabaseUrl!, publishableKey!, {
      auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;

function accountSession(session: Session | null): AccountSession | null {
  if (!session?.user.id || !session.user.email) return null;
  return { userId: session.user.id, email: session.user.email };
}

function redirectUrl(): string {
  return Linking.createURL('auth/callback');
}

class SupabaseAuthService implements AuthService {
  constructor(private client: SupabaseClient) {}

  async getSession(): Promise<AccountSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return accountSession(data.session);
  }

  subscribe(listener: (session: AccountSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) =>
      listener(accountSession(session)),
    );
    return () => data.subscription.unsubscribe();
  }

  async signUp(email: string, password: string): Promise<{ session: AccountSession | null }> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl() },
    });
    if (error) throw error;
    return { session: accountSession(data.session) };
  }

  async signIn(email: string, password: string): Promise<AccountSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const session = accountSession(data.session);
    if (!session) throw new Error('登录成功，但没有读取到账号信息');
    return session;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
    if (error) throw error;
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
  }

  async handleCallback(url: string): Promise<{ kind: AuthCallbackKind; session: AccountSession }> {
    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const code = parsed.searchParams.get('code');
    const type = parsed.searchParams.get('type') ?? hash.get('type');
    let session: Session | null = null;
    if (code) {
      const result = await this.client.auth.exchangeCodeForSession(code);
      if (result.error) throw result.error;
      session = result.data.session;
    } else {
      const accessToken = hash.get('access_token') ?? parsed.searchParams.get('access_token');
      const refreshToken = hash.get('refresh_token') ?? parsed.searchParams.get('refresh_token');
      if (!accessToken || !refreshToken) throw new Error('邮箱链接无效或已经过期');
      const result = await this.client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (result.error) throw result.error;
      session = result.data.session;
    }
    const value = accountSession(session);
    if (!value) throw new Error('邮箱链接没有返回有效账号');
    return { kind: type === 'recovery' ? 'recovery' : 'confirmed', session: value };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.client.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw error;
    const signOut = await this.client.auth.signOut({ scope: 'local' });
    if (signOut.error) throw signOut.error;
  }

  startAutoRefresh(): void {
    this.client.auth.startAutoRefresh();
  }

  stopAutoRefresh(): void {
    this.client.auth.stopAutoRefresh();
  }
}

export const authService: AuthService | null = supabaseClient
  ? new SupabaseAuthService(supabaseClient)
  : null;
