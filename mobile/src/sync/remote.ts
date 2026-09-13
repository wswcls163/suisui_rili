import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeDraft } from '../core/birthday';
import { normalizeCountupDraft, type Countup } from '../core/countup';
import { supabaseClient } from '../auth/client';
import {
  accountOwner,
  isAccountOwner,
  itemType,
  type ApplyMutationResult,
  type CalendarItem,
  type RemoteBirthdayGateway,
  type RemoteItem,
  type SyncMutation,
} from './model';

type BirthdayRow = {
  id: string;
  item_type?: 'birthday' | 'countup';
  name: string;
  lunar_month: number | null;
  lunar_day: number | null;
  is_leap: boolean | null;
  solar_month: number | null;
  solar_day: number | null;
  start_date?: string | null;
  note?: string | null;
  display_mode?: 'days' | 'anniversary';
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function fromRow(row: BirthdayRow): RemoteItem {
  const draft =
    row.item_type === 'countup'
      ? normalizeCountupDraft({
          type: 'countup',
          title: row.name,
          startDate: row.start_date,
          note: row.note ?? '',
          displayMode: row.display_mode ?? 'days',
        })
      : normalizeDraft({
          name: row.name,
          lunar:
            row.lunar_month === null
              ? null
              : { month: row.lunar_month, day: row.lunar_day, isLeap: row.is_leap },
          solar: row.solar_month === null ? null : { month: row.solar_month, day: row.solar_day },
        });
  if (!row.id || !row.created_at || !row.updated_at || !Number.isInteger(row.version) || row.version < 1)
    throw new Error('云端返回了无效的事项数据');
  return {
    ...draft,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

function payload(mutation: SyncMutation) {
  if (!mutation.payload) return null;
  if (itemType(mutation.payload) === 'countup') {
    const countup = mutation.payload as Countup;
    return {
      item_type: 'countup',
      name: countup.title,
      start_date: countup.startDate,
      note: countup.note,
      display_mode: countup.displayMode,
      lunar_month: null,
      lunar_day: null,
      is_leap: null,
      solar_month: null,
      solar_day: null,
    };
  }
  const birthday = mutation.payload as Exclude<CalendarItem, Countup>;
  return {
    item_type: 'birthday',
    name: birthday.name,
    lunar_month: birthday.lunar?.month ?? null,
    lunar_day: birthday.lunar?.day ?? null,
    is_leap: birthday.lunar?.isLeap ?? null,
    solar_month: birthday.solar?.month ?? null,
    solar_day: birthday.solar?.day ?? null,
    start_date: null,
    note: '',
    display_mode: 'days',
  };
}

export class SupabaseBirthdayGateway implements RemoteBirthdayGateway {
  private verifiedOwner: { ownerKey: string; until: number } | null = null;

  constructor(private client: SupabaseClient) {}

  private async requireOwner(ownerKey: string): Promise<string> {
    if (!isAccountOwner(ownerKey)) throw new Error('账号数据范围无效');
    const sessionResult = await this.client.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    const session = sessionResult.data.session;
    const userId = session?.user.id;
    if (!userId || accountOwner(userId) !== ownerKey) {
      this.verifiedOwner = null;
      throw new Error('账号会话已经变化，已停止同步');
    }
    if (this.verifiedOwner?.ownerKey === ownerKey && this.verifiedOwner.until > Date.now()) return userId;
    const userResult = await this.client.auth.getUser(session.access_token);
    if (userResult.error) throw userResult.error;
    if (!userResult.data.user || userResult.data.user.id !== userId) {
      this.verifiedOwner = null;
      throw new Error('账号会话验证失败，已停止同步');
    }
    this.verifiedOwner = { ownerKey, until: Date.now() + 30_000 };
    return userId;
  }

  private async requireTimeNoteModes(): Promise<void> {
    const { error } = await this.client.from('birthdays').select('display_mode').limit(1);
    if (!error) return;
    if (error.code === '42703' || error.code === 'PGRST204')
      throw new Error('云端尚未支持“每年纪念”，请先应用最新数据库迁移');
    throw error;
  }

  async list(ownerKey: string): Promise<RemoteItem[]> {
    const userId = await this.requireOwner(ownerKey);
    const { data, error } = await this.client
      .from('birthdays')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');
    if (error) throw error;
    return (data as BirthdayRow[]).map(fromRow);
  }

  async apply(mutation: SyncMutation): Promise<ApplyMutationResult> {
    await this.requireOwner(mutation.ownerKey);
    if (
      mutation.payload &&
      itemType(mutation.payload) === 'countup' &&
      (mutation.payload as Countup).displayMode === 'anniversary'
    )
      await this.requireTimeNoteModes();
    const { data, error } = await this.client.rpc('apply_birthday_mutation', {
      p_operation_id: mutation.operationId,
      p_birthday_id: mutation.birthdayId,
      p_kind: mutation.kind,
      p_base_version: mutation.baseVersion,
      p_payload: payload(mutation),
    });
    if (error) throw error;
    const result = data as { status?: string; record?: BirthdayRow } | null;
    if (!result?.record || (result.status !== 'applied' && result.status !== 'conflict'))
      throw new Error('云端没有返回有效的同步结果');
    if (
      result.status === 'applied' &&
      mutation.payload &&
      itemType(mutation.payload) === 'countup' &&
      (mutation.payload as Countup).displayMode === 'anniversary' &&
      result.record.display_mode !== 'anniversary'
    )
      throw new Error('云端尚未支持“每年纪念”，请先应用最新数据库迁移');
    return { status: result.status, record: fromRow(result.record) };
  }
}

export const remoteGateway: RemoteBirthdayGateway | null = supabaseClient
  ? new SupabaseBirthdayGateway(supabaseClient)
  : null;
