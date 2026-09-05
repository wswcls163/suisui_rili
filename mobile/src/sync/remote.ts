import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeDraft } from '../core/birthday';
import { supabaseClient } from '../auth/client';
import type { ApplyMutationResult, RemoteBirthday, RemoteBirthdayGateway, SyncMutation } from './model';

type BirthdayRow = {
  id: string;
  name: string;
  lunar_month: number | null;
  lunar_day: number | null;
  is_leap: boolean | null;
  solar_month: number | null;
  solar_day: number | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function fromRow(row: BirthdayRow): RemoteBirthday {
  const draft = normalizeDraft({
    name: row.name,
    lunar:
      row.lunar_month === null ? null : { month: row.lunar_month, day: row.lunar_day, isLeap: row.is_leap },
    solar: row.solar_month === null ? null : { month: row.solar_month, day: row.solar_day },
  });
  if (!row.id || !row.created_at || !row.updated_at || !Number.isInteger(row.version) || row.version < 1)
    throw new Error('云端返回了无效的生日数据');
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
  return {
    name: mutation.payload.name,
    lunar_month: mutation.payload.lunar?.month ?? null,
    lunar_day: mutation.payload.lunar?.day ?? null,
    is_leap: mutation.payload.lunar?.isLeap ?? null,
    solar_month: mutation.payload.solar?.month ?? null,
    solar_day: mutation.payload.solar?.day ?? null,
  };
}

export class SupabaseBirthdayGateway implements RemoteBirthdayGateway {
  constructor(private client: SupabaseClient) {}

  async list(): Promise<RemoteBirthday[]> {
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
