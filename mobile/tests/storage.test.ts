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

const dir = mkdtempSync(join(tmpdir(), 'suisui-storage-test-'));
after(() => {
  // Remove only the exact temporary directory owned by this test invocation.
  assert.ok(
    resolve(dir).startsWith(resolve(tmpdir()) + '\\') || resolve(dir).startsWith(resolve(tmpdir()) + '/'),
  );
  assert.ok(dir.includes('suisui-storage-test-'));
  rmSync(dir, { recursive: true });
});
const draft = { name: '妈妈', month: 2, day: 30, isLeap: true };
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
      assert.equal((await repo.list())[0].day, 30);
      assert.equal((await repo.list())[0].isLeap, true);
      const updated = await repo.update(first.id, { ...draft, name: '爸爸', day: 29 });
      assert.equal(updated.createdAt, first.createdAt);
      assert.equal(updated.id, first.id);
      await assert.rejects(repo.update('missing', draft), /不存在/);
      await assert.rejects(repo.remove('missing'), /不存在/);
      await assert.rejects(repo.create({ ...draft, month: 13 }), /月份/);
      await assert.rejects(repo.create({ ...draft, isLeap: 1 } as never), /闰月/);
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
test('SQLite: 迁移事务连同版本号回滚，重新打开可以恢复初始化', async () => {
  const file = join(dir, 'migration.db');
  let db = sqlite(file, 'CREATE INDEX');
  await assert.rejects(migrateDatabase(db), /注入失败/);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 0);
  assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='birthdays'"), null);
  await db.closeAsync();
  db = sqlite(file);
  await migrateDatabase(db);
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 1);
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
  await assert.rejects(db.runAsync('UPDATE birthdays SET day=? WHERE id=?', 31, 'a'));
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
    "CREATE TABLE future_data(value TEXT); INSERT INTO future_data VALUES ('keep me'); PRAGMA user_version=2;",
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
  assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 2);
  await db.closeAsync();
});
test('IndexedDB: 更高版本拒绝写入，保留已有记录', async () => {
  const name = `suisui-future-${Date.now()}`;
  const future = new Dexie(name);
  future.version(2).stores({ birthdays: 'id,createdAt', extra: 'id' });
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
