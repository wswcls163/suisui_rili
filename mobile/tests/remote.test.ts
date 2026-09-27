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

function verifiedAuth(userId = 'account') {
  return {
    getSession: jest.fn(async () => ({
      data: { session: { access_token: 'verified-token', user: { id: userId } } },
      error: null,
    })),
    getUser: jest.fn(async () => ({ data: { user: { id: userId } }, error: null })),
  };
}

test('旧云端缺少展示方式字段时阻止提交，避免静默覆盖每年纪念', async () => {
  const rpc = jest.fn();
  const unsupported = new SupabaseBirthdayGateway({
    auth: verifiedAuth(),
    from: () => ({
      select: () => ({ limit: async () => ({ error: { code: '42703', message: '字段不存在' } }) }),
    }),
    rpc,
  } as never);
  await expect(unsupported.apply(mutation)).rejects.toThrow('最新数据库迁移');
  expect(rpc).not.toHaveBeenCalled();

  const supported = new SupabaseBirthdayGateway({
    auth: verifiedAuth(),
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

test('云端读写先核对当前会话归属，列表同时显式限定用户', async () => {
  const rpc = jest.fn();
  const from = jest.fn();
  const wrongOwner = new SupabaseBirthdayGateway({ auth: verifiedAuth('another'), rpc, from } as never);
  await expect(wrongOwner.apply(mutation)).rejects.toThrow('账号会话已经变化');
  expect(rpc).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();

  const order = jest.fn(async () => ({ data: [{ ...record, display_mode: 'anniversary' }], error: null }));
  const eq = jest.fn(() => ({ order }));
  const verified = new SupabaseBirthdayGateway({
    auth: verifiedAuth(),
    from: jest.fn(() => ({
      select: (columns: string) =>
        columns === 'birth_year' ? { limit: async () => ({ error: null }) } : { eq },
    })),
  } as never);
  await expect(verified.list('user:account')).resolves.toHaveLength(1);
  expect(eq).toHaveBeenCalledWith('user_id', 'account');
});

test('出生年份字段缺失时同步明确失败，迁移后上传和读取都保留年份', async () => {
  const birthdayMutation: SyncMutation = {
    ...mutation,
    itemType: 'birthday',
    payload: {
      id: record.id,
      name: '妈妈',
      lunar: null,
      solar: { month: 9, day: 22 },
      birthYear: 2000,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    },
  };
  const unavailableRpc = jest.fn();
  const unavailable = new SupabaseBirthdayGateway({
    auth: verifiedAuth(),
    from: () => ({
      select: () => ({ limit: async () => ({ error: { code: 'PGRST204', message: 'missing' } }) }),
    }),
    rpc: unavailableRpc,
  } as never);
  await expect(unavailable.apply(birthdayMutation)).rejects.toThrow('出生年份');
  expect(unavailableRpc).not.toHaveBeenCalled();

  const rpc = jest.fn(async () => ({
    data: {
      status: 'applied',
      record: {
        ...record,
        item_type: 'birthday',
        name: '妈妈',
        solar_month: 9,
        solar_day: 22,
        birth_year: 2000,
        start_date: null,
      },
    },
    error: null,
  }));
  const supported = new SupabaseBirthdayGateway({
    auth: verifiedAuth(),
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
    rpc,
  } as never);
  await expect(supported.apply(birthdayMutation)).resolves.toMatchObject({
    record: { birthYear: 2000 },
  });
  expect(rpc).toHaveBeenCalledWith(
    'apply_birthday_mutation',
    expect.objectContaining({ p_payload: expect.objectContaining({ birth_year: 2000 }) }),
  );
});
