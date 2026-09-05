import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeDraft } from '../core/birthday';
import { normalizeCountupDraft, type Countup } from '../core/countup';
import { supabaseClient } from '../auth/client';
import {
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
  };
}

export class SupabaseBirthdayGateway implements RemoteBirthdayGateway {
  constructor(private client: SupabaseClient) {}

  async list(): Promise<RemoteItem[]> {
    const { data, error } = await this.client.from('birthdays').select('*').order('created_at');
    if (error) throw error;
    return (data as BirthdayRow[]).map(fromRow);
  }

  async apply(mutation: SyncMutation): Promise<ApplyMutationResult> {
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
    return { status: result.status, record: fromRow(result.record) };
  }
}

export const remoteGateway: RemoteBirthdayGateway | null = supabaseClient
  ? new SupabaseBirthdayGateway(supabaseClient)
  : null;
