import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Dexie } from 'dexie';
import { migrateDatabase, SqliteBirthdayRepository, type SqlDatabase } from '../src/data/sqlite';
import { WebBirthdayRepository } from '../src/data/web';
import type { BirthdayRepository } from '../src/core/birthday';
import type { SyncBirthdayRepository } from '../src/sync/model';

const dir = mkdtempSync(join(tmpdir(), 'suisui-storage-test-'));
after(() => {
  // Remove only the exact temporary directory owned by this test invocation.
  assert.ok(
    resolve(dir).startsWith(resolve(tmpdir()) + '\\') || resolve(dir).startsWith(resolve(tmpdir()) + '/'),
  );
  assert.ok(dir.includes('suisui-storage-test-'));
  rmSync(dir, { recursive: true });
});
const draft = { name: '妈妈', lunar: { month: 2, day: 30, isLeap: true }, solar: null };
function sqlite(file: string, failAfter?: string): SqlDatabase {
  const db = new DatabaseSync(file);
  const adapter: SqlDatabase = {
    async execAsync(sql) {
      db.exec(sql);
      if (failAfter && sql.includes(failAfter)) throw new Error('注入失败');
    },
    async runAsync(sql, ...params) {
      return { changes: Number(db.prepare(sql).run(...params).changes) };
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async withExclusiveTransactionAsync(work) {
      db.exec('BEGIN EXCLUSIVE');
      try {
        await work(adapter);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    async closeAsync() {
      db.close();
    },
  };
  return adapter;
}
for (const engine of ['SQLite', 'IndexedDB'] as const) {
  test(`${engine}: 空库、CRUD、原始字段、关闭重开、非法输入和不存在 ID`, async () => {
    const name = engine === 'SQLite' ? join(dir, 'birthdays.db') : `suisui-test-${Date.now()}`;
    let number = 0;
    const make = (): BirthdayRepository =>
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => `id-${++number}`,
          )
        : new WebBirthdayRepository(name, () => `id-${++number}`);
    let repo = make();
    try {
      await Promise.all([repo.initialize(), repo.initialize()]);
      assert.deepEqual(await repo.list(), []);
      const first = await repo.create({ ...draft, name: ' 妈妈 ' });
      await repo.create(draft); // 同名合法
      assert.equal(first.name, '妈妈');
      await repo.close();
      repo = make();
      assert.equal((await repo.list()).length, 2);
      assert.equal((await repo.list())[0].lunar?.day, 30);
      assert.equal((await repo.list())[0].lunar?.isLeap, true);
      const updated = await repo.update(first.id, {
        ...draft,
        name: '爸爸',
        lunar: { ...draft.lunar, day: 29 },
      });
      assert.equal(updated.createdAt, first.createdAt);
      assert.equal(updated.id, first.id);
      await assert.rejects(repo.update('missing', draft), /不存在/);
      await assert.rejects(repo.remove('missing'), /不存在/);
      await assert.rejects(repo.create({ ...draft, lunar: { ...draft.lunar, month: 13 } }), /月份/);
      await assert.rejects(repo.create({ ...draft, lunar: { ...draft.lunar, isLeap: 1 } } as never), /闰月/);
      assert.equal((await repo.list()).length, 2);
      await repo.remove(first.id);
      await repo.close();
      repo = make();
      assert.equal((await repo.list()).length, 1);
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });
}
for (const engine of ['SQLite', 'IndexedDB'] as const) {
  test(`${engine}: 时光记 CRUD、展示方式持久化与类型隔离`, async () => {
    const name = engine === 'SQLite' ? join(dir, `countups-${engine}.db`) : `suisui-countups-${Date.now()}`;
    let sequence = 0;
    const make = () =>
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => `countup-${++sequence}`,
          )
        : new WebBirthdayRepository(name, () => `countup-${++sequence}`);
    let repo = make();
    try {
      const created = await repo.createCountup({
        type: 'countup',
        title: ' 开始健身 ',
        startDate: '2026-09-05',
        note: ' 每天半小时 ',
        displayMode: 'anniversary',
      });
      assert.equal(created.title, '开始健身');
      assert.equal(created.note, '每天半小时');
      assert.equal(created.displayMode, 'anniversary');
      assert.deepEqual(await repo.list(), []);
      await repo.close();
      repo = make();
      assert.equal((await repo.listCountups())[0].startDate, '2026-09-05');
      const updated = await repo.updateCountup(created.id, {
        type: 'countup',
        title: '坚持健身',
        startDate: '2026-09-06',
        note: '',
        displayMode: 'days',
      });
      assert.equal(updated.createdAt, created.createdAt);
      assert.equal((await repo.listCountups())[0].title, '坚持健身');
      await assert.rejects(
        repo.createCountup({
          type: 'countup',
          title: '',
          startDate: '2026-09-05',
          note: '',
          displayMode: 'days',
        }),
        /记录名称/,
      );
      await repo.removeCountup(created.id);
      assert.deepEqual(await repo.listCountups(), []);
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });
}

for (const engine of ['SQLite', 'IndexedDB'] as const) {
  test(`${engine}: v4 累计日升级为时光记后默认记录天数`, async () => {
    const name =
      engine === 'SQLite' ? join(dir, `time-note-upgrade-${engine}.db`) : `suisui-time-note-${Date.now()}`;
    if (engine === 'SQLite') {
      const old = sqlite(name);
      await old.execAsync(`CREATE TABLE birthdays (
        ownerKey TEXT NOT NULL,id TEXT NOT NULL,itemType TEXT NOT NULL,name TEXT NOT NULL,
        lunarMonth INTEGER,lunarDay INTEGER,isLeap INTEGER,solarMonth INTEGER,solarDay INTEGER,
        startDate TEXT,note TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,
        remoteVersion INTEGER NOT NULL,deletedAt TEXT,PRIMARY KEY(ownerKey,id));
        INSERT INTO birthdays VALUES (
          'guest','legacy-time','countup','开始健身',NULL,NULL,NULL,NULL,NULL,
          '2026-09-05','每天半小时','2026-09-05T00:00:00Z','2026-09-05T00:00:00Z',0,NULL);
        PRAGMA user_version=4;`);
      await old.closeAsync();
    } else {
      const old = new Dexie(name);
      old.version(4).stores({
        birthdays: 'id,ownerKey,itemType,[ownerKey+birthdayId],[ownerKey+createdAt]',
        sync_outbox: 'storageKey,ownerKey,itemType,operationId,createdAt',
        sync_conflicts: 'storageKey,ownerKey,itemType,createdAt',
      });
      await old.table('birthdays').add({
        id: 'guest\0legacy-time',
        birthdayId: 'legacy-time',
        ownerKey: 'guest',
        itemType: 'countup',
        title: '开始健身',
        startDate: '2026-09-05',
        note: '每天半小时',
        createdAt: '2026-09-05T00:00:00Z',
        updatedAt: '2026-09-05T00:00:00Z',
        remoteVersion: 0,
        deletedAt: null,
      });
      old.close();
    }

    const repo =
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => 'new',
          )
        : new WebBirthdayRepository(name, () => 'new');
    try {
      const [record] = await repo.listCountups();
      assert.equal(record.title, '开始健身');
      assert.equal(record.startDate, '2026-09-05');
      assert.equal(record.displayMode, 'days');
      assert.equal(record.createdAt, '2026-09-05T00:00:00Z');
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });
}

test('SQLite: 迁移事务连同版本号回滚，重新打开可以恢复初始化', async () => {
  const file = join(dir, 'migration.db');
  let db = sqlite(file, 'CREATE INDEX');
  await assert.rejects(migrateDatabase(db), /注入失败/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 0);
  assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='birthdays'"), null);
  await db.closeAsync();
  db = sqlite(file);
  await migrateDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 5);
  await db.closeAsync();
});
test('SQLite: 写入事务失败保留旧记录，数据库约束防止非法原始值', async () => {
  const file = join(dir, 'rollback.db');
  const repo = new SqliteBirthdayRepository(
    async () => sqlite(file),
    () => 'a',
  );
  const original = await repo.create(draft);
  const db = sqlite(file);
  await db.execAsync(
    "CREATE TRIGGER reject_update AFTER UPDATE ON birthdays BEGIN SELECT RAISE(ABORT, 'disk failure'); END;",
  );
  await assert.rejects(repo.update('a', { ...draft, name: '新名字' }), /disk failure/);
  assert.deepEqual(await repo.list(), [original]);
  await assert.rejects(db.runAsync('UPDATE birthdays SET lunarDay=? WHERE id=?', 31, 'a'));
  await assert.rejects(db.runAsync('UPDATE birthdays SET isLeap=? WHERE id=?', 2, 'a'));
  await assert.rejects(repo.create(draft)); // ID 冲突不能覆盖
  assert.deepEqual(await repo.list(), [original]);
  await repo.close();
  await db.closeAsync();
});
test('SQLite: 更高版本拒绝初始化，已有数据和版本号不变', async () => {
  const file = join(dir, 'future.db');
  const db = sqlite(file);
  await db.execAsync(
    "CREATE TABLE future_data(value TEXT); INSERT INTO future_data VALUES ('keep me'); PRAGMA user_version=6;",
  );
  const repo = new SqliteBirthdayRepository(
    async () => sqlite(file),
    () => 'a',
  );
  await assert.rejects(repo.initialize(), /更新版本/);
  assert.equal(
    (await db.getFirstAsync<{ value: string }>('SELECT value FROM future_data'))?.value,
    'keep me',
  );
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 6);
  await db.closeAsync();
});
test('IndexedDB: 更高版本拒绝写入，保留已有记录', async () => {
  const name = `suisui-future-${Date.now()}`;
  const future = new Dexie(name);
  future.version(6).stores({ birthdays: 'id,createdAt', extra: 'id' });
  await future.open();
  await future.table('extra').add({ id: 'keep' });
  future.close();
  const repo = new WebBirthdayRepository(name);
  await assert.rejects(repo.create(draft));
  await repo.close();
  await future.open();
  assert.deepEqual(await future.table('extra').toArray(), [{ id: 'keep' }]);
  future.close();
  await Dexie.delete(name);
});

const legacy = {
  id: 'legacy',
  name: '爸爸生日',
  month: 12,
  day: 9,
  isLeap: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};
async function seedSqlV1(file: string) {
  const db = sqlite(file);
  await db.execAsync(`CREATE TABLE birthdays (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, month INTEGER NOT NULL, day INTEGER NOT NULL,
    isLeap INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE INDEX birthdays_created ON birthdays(createdAt, id); PRAGMA user_version=1;`);
  await db.runAsync(
    'INSERT INTO birthdays VALUES (?,?,?,?,?,?,?)',
    legacy.id,
    legacy.name,
    legacy.month,
    legacy.day,
    0,
    legacy.createdAt,
    legacy.updatedAt,
  );
  await db.closeAsync();
}
for (const engine of ['SQLite', 'IndexedDB'] as const) {
  test(`${engine}: v1 原始生日升级为仅农历，双生日新增、修改、重开和删除完整保留`, async () => {
    const name = engine === 'SQLite' ? join(dir, 'upgrade.db') : `suisui-upgrade-${Date.now()}`;
    if (engine === 'SQLite') await seedSqlV1(name);
    else {
      const old = new Dexie(name);
      old.version(1).stores({ birthdays: 'id,createdAt' });
      await old.table('birthdays').add(legacy);
      old.close();
    }
    const make = () =>
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => 'new',
          )
        : new WebBirthdayRepository(name, () => 'new');
    let repo = make();
    try {
      const [old] = await repo.list();
      assert.deepEqual(old, {
        id: legacy.id,
        name: legacy.name,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
        lunar: { month: 12, day: 9, isLeap: false },
        solar: null,
      });
      const both = await repo.update(old.id, { ...old, solar: { month: 1, day: 11 } });
      assert.equal(both.createdAt, legacy.createdAt);
      await repo.close();
      repo = make();
      assert.deepEqual(await repo.list(), [both]);
      const solarOnly = await repo.update(old.id, { ...both, lunar: null });
      await repo.close();
      repo = make();
      assert.deepEqual(await repo.list(), [solarOnly]);
      const lunarOnly = await repo.update(old.id, { ...both, solar: null });
      assert.deepEqual(await repo.list(), [lunarOnly]);
      await assert.rejects(repo.update(old.id, { ...both, solar: { month: 4, day: 31 } }));
      assert.deepEqual(await repo.list(), [lunarOnly]);
      await repo.create({
        name: '双生日',
        lunar: { month: 2, day: 30, isLeap: true },
        solar: { month: 2, day: 29 },
      });
      await repo.close();
      repo = make();
      assert.equal((await repo.list()).length, 2);
      assert.deepEqual((await repo.list()).find((p) => p.id === 'new')?.solar, { month: 2, day: 29 });
      await repo.remove('new');
      await repo.remove(old.id);
      assert.deepEqual(await repo.list(), []);
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });
}
test('SQLite: v1 升级失败回滚旧表、记录和版本，再次打开可重试', async () => {
  const file = join(dir, 'upgrade-rollback.db');
  await seedSqlV1(file);
  const failing = sqlite(file, 'DROP TABLE');
  try {
    await assert.rejects(migrateDatabase(failing), /注入失败/);
    assert.equal(
      (await failing.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version,
      1,
    );
    const rows = await failing.getAllAsync<Record<string, unknown>>('SELECT * FROM birthdays');
    assert.deepEqual(
      rows.map((row) => ({ ...row })),
      [{ ...legacy, isLeap: 0 }],
    );
    assert.equal(
      await failing.getFirstAsync("SELECT name FROM sqlite_master WHERE name='birthdays_v2'"),
      null,
    );
  } finally {
    await failing.closeAsync();
  }
  const repo = new SqliteBirthdayRepository(
    async () => sqlite(file),
    () => 'new',
  );
  assert.equal((await repo.list())[0].lunar?.day, 9);
  await repo.close();
});
test('IndexedDB: v1 升级发现非法记录时整笔回滚，不覆盖旧数据', async () => {
  const name = `suisui-upgrade-fail-${Date.now()}`;
  const old = new Dexie(name);
  old.version(1).stores({ birthdays: 'id,createdAt' });
  const rows = [legacy, { ...legacy, id: 'invalid', day: 31 }];
  await old.table('birthdays').bulkAdd(rows);
  old.close();
  const repo = new WebBirthdayRepository(name);
  await assert.rejects(repo.initialize(), /农历日期/);
  await repo.close();
  await old.open();
  assert.equal(old.backendDB().version, 10);
  assert.deepEqual(
    (await old.table('birthdays').toArray()).sort((a, b) => a.id.localeCompare(b.id)),
    [...rows].sort((a, b) => a.id.localeCompare(b.id)),
  );
  old.close();
  await Dexie.delete(name);
});
test('SQLite: 约束拒绝不完整日期、两套都为空及无效阳历月日', async () => {
  const file = join(dir, 'dual-constraints.db');
  const repo = new SqliteBirthdayRepository(
    async () => sqlite(file),
    () => 'a',
  );
  const original = await repo.create({ ...draft, solar: { month: 1, day: 11 } });
  const db = sqlite(file);
  for (const sql of [
    'UPDATE birthdays SET lunarDay=NULL',
    'UPDATE birthdays SET solarDay=NULL',
    'UPDATE birthdays SET lunarMonth=NULL,lunarDay=NULL,isLeap=NULL,solarMonth=NULL,solarDay=NULL',
    'UPDATE birthdays SET solarMonth=2,solarDay=30',
    'UPDATE birthdays SET solarMonth=4,solarDay=31',
  ])
    await assert.rejects(db.execAsync(sql));
  assert.deepEqual(await repo.list(), [original]);
  await repo.close();
  await db.closeAsync();
});

for (const engine of ['SQLite', 'IndexedDB'] as const) {
  test(`${engine}: 访客数据与账号数据隔离，合并后进入待同步队列`, async () => {
    const name = engine === 'SQLite' ? join(dir, `scope-${engine}.db`) : `suisui-scope-${Date.now()}`;
    let sequence = 0;
    const repo: SyncBirthdayRepository =
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => `scope-${++sequence}`,
          )
        : new WebBirthdayRepository(name, () => `scope-${++sequence}`);
    try {
      const guest = await repo.create(draft);
      assert.equal(await repo.guestCount(), 1);
      assert.deepEqual(await repo.pending(), []);

      await repo.setOwner('user:account-a');
      assert.deepEqual(await repo.list(), []);
      const transient = await repo.create({ ...draft, name: '临时记录' });
      await repo.update(transient.id, { ...draft, name: '改过的临时记录' });
      assert.equal((await repo.pending()).length, 1);
      assert.equal((await repo.pending())[0].baseVersion, 0);
      await repo.remove(transient.id);
      assert.deepEqual(await repo.pending(), []);
      assert.deepEqual(await repo.list(), []);

      assert.deepEqual(await repo.importGuest(), { imported: 1, skipped: 0 });
      const [mutation] = await repo.pending();
      assert.equal(mutation.kind, 'upsert');
      assert.equal(mutation.payload && 'name' in mutation.payload ? mutation.payload.name : null, guest.name);
      const remote = { ...mutation.payload!, version: 1, deletedAt: null };
      await repo.acknowledge(mutation, remote);
      assert.deepEqual(await repo.pending(), []);
      assert.equal((await repo.list())[0].name, '妈妈');

      await repo.clearGuest();
      assert.equal(await repo.guestCount(), 0);
      assert.equal((await repo.list()).length, 1);
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });

  test(`${engine}: 访客时光记仅备注不同时仍全部导入，避免去重丢失`, async () => {
    const name =
      engine === 'SQLite' ? join(dir, `countup-note-${engine}.db`) : `suisui-countup-note-${Date.now()}`;
    let sequence = 0;
    const repo: SyncBirthdayRepository =
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => `countup-note-${++sequence}`,
          )
        : new WebBirthdayRepository(name, () => `countup-note-${++sequence}`);
    const base = {
      type: 'countup' as const,
      title: '每天锻炼',
      startDate: '2026-09-13',
      displayMode: 'days' as const,
    };
    try {
      await repo.createCountup({ ...base, note: '跑步' });
      await repo.createCountup({ ...base, note: '游泳' });
      await repo.setOwner('user:account-notes');
      assert.deepEqual(await repo.importGuest(), { imported: 2, skipped: 0 });
      assert.deepEqual((await repo.listCountups()).map((item) => item.note).sort(), ['游泳', '跑步']);
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });

  test(`${engine}: 保存期间切换账号仍写入原账号范围，不会串到新账号`, async () => {
    const name =
      engine === 'SQLite' ? join(dir, `owner-race-${engine}.db`) : `suisui-owner-race-${Date.now()}`;
    let sequence = 0;
    const repo: SyncBirthdayRepository =
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => `owner-race-${++sequence}`,
          )
        : new WebBirthdayRepository(name, () => `owner-race-${++sequence}`);
    try {
      await repo.setOwner('user:account-a');
      const originalInitialize = repo.initialize.bind(repo);
      let entered!: () => void;
      let release!: () => void;
      const started = new Promise<void>((resolve) => (entered = resolve));
      const paused = new Promise<void>((resolve) => (release = resolve));
      repo.initialize = async () => {
        entered();
        await paused;
        return originalInitialize();
      };
      const saving = repo.create({ ...draft, name: '账号 A 的生日' });
      await started;
      repo.initialize = originalInitialize;
      await repo.setOwner('user:account-b');
      release();
      await saving;

      assert.deepEqual(await repo.list(), []);
      assert.deepEqual(await repo.pending(), []);
      await repo.setOwner('user:account-a');
      assert.equal((await repo.list())[0].name, '账号 A 的生日');
      assert.equal((await repo.pending()).length, 1);
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });

  test(`${engine}: 远端变更与本机修改冲突时保留两份内容并可逐条解决`, async () => {
    const name = engine === 'SQLite' ? join(dir, `conflict-${engine}.db`) : `suisui-conflict-${Date.now()}`;
    let sequence = 0;
    const repo: SyncBirthdayRepository =
      engine === 'SQLite'
        ? new SqliteBirthdayRepository(
            async () => sqlite(name),
            () => `conflict-${++sequence}`,
          )
        : new WebBirthdayRepository(name, () => `conflict-${++sequence}`);
    try {
      await repo.setOwner('user:account-b');
      const base = {
        id: 'shared',
        name: '妈妈',
        lunar: { month: 2, day: 30, isLeap: false },
        solar: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        version: 1,
        deletedAt: null,
      };
      assert.equal(await repo.mergeRemote([base], 'user:another-account'), 0);
      assert.deepEqual(await repo.list(), []);
      assert.equal(await repo.mergeRemote([base], 'user:account-b'), 1);
      await repo.update(base.id, { ...draft, name: '本机妈妈' });
      const remote = { ...base, name: '云端妈妈', version: 2, updatedAt: '2026-02-01T00:00:00.000Z' };
      assert.equal(await repo.mergeRemote([remote], 'user:account-b'), 1);
      assert.deepEqual(await repo.pending(), []);
      assert.equal(((await repo.conflicts())[0].local as { name: string }).name, '本机妈妈');
      assert.equal(((await repo.conflicts())[0].remote as { name: string }).name, '云端妈妈');

      await repo.resolveConflict(base.id, 'remote');
      assert.deepEqual(await repo.conflicts(), []);
      assert.equal((await repo.list())[0].name, '云端妈妈');

      await repo.update(base.id, { ...draft, name: '最终保留本机' });
      const [pending] = await repo.pending();
      const newer = { ...remote, name: '另一台设备', version: 3 };
      await repo.recordConflict(pending, newer);
      await repo.resolveConflict(base.id, 'local');
      assert.equal((await repo.list())[0].name, '最终保留本机');
      assert.equal((await repo.pending())[0].baseVersion, 3);
      assert.equal((await repo.pending())[0].kind, 'upsert');
    } finally {
      await repo.close();
      if (engine === 'IndexedDB') await Dexie.delete(name);
    }
  });
}
