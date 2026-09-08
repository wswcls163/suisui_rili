import { SupabaseBirthdayGateway } from '../src/sync/remote';
import type { SyncMutation } from '../src/sync/model';

const record = {
  id: '10000000-0000-0000-0000-000000000001',
  item_type: 'countup' as const,
  name: '我们在一起',
  lunar_month: null,
  lunar_day: null,
  is_leap: null,
  solar_month: null,
  solar_day: null,
  start_date: '2025-09-08',
  note: '',
  created_at: '2026-09-08T00:00:00Z',
  updated_at: '2026-09-08T00:00:00Z',
  version: 1,
  deleted_at: null,
};

const mutation: SyncMutation = {
  ownerKey: 'user:account',
  operationId: '20000000-0000-0000-0000-000000000001',
  birthdayId: record.id,
  itemType: 'countup',
  kind: 'upsert',
  baseVersion: 0,
  payload: {
    id: record.id,
    type: 'countup',
    title: record.name,
    startDate: record.start_date,
    note: '',
    displayMode: 'anniversary',
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  },
  createdAt: record.created_at,
};

test('旧云端缺少展示方式字段时阻止提交，避免静默覆盖每年纪念', async () => {
  const rpc = jest.fn();
  const unsupported = new SupabaseBirthdayGateway({
    from: () => ({
      select: () => ({ limit: async () => ({ error: { code: '42703', message: '字段不存在' } }) }),
    }),
    rpc,
  } as never);
  await expect(unsupported.apply(mutation)).rejects.toThrow('最新数据库迁移');
  expect(rpc).not.toHaveBeenCalled();

  const supported = new SupabaseBirthdayGateway({
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
    rpc: async () => ({
      data: { status: 'applied', record: { ...record, display_mode: 'anniversary' } },
      error: null,
    }),
  } as never);
  await expect(supported.apply(mutation)).resolves.toMatchObject({
    status: 'applied',
    record: { displayMode: 'anniversary' },
  });
});
