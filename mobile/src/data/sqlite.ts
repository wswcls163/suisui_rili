import type { Birthday, BirthdayDraft, BirthdayRepository } from '../core/birthday';
import { normalizeDraft } from '../core/birthday';

type Param = string | number | null;
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Param[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...params: Param[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: Param[]): Promise<T[]>;
  withExclusiveTransactionAsync(work: (transaction: SqlDatabase) => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}
type StoredBirthday = Omit<Birthday, 'isLeap'> & { isLeap: number };
export async function migrateDatabase(db: SqlDatabase): Promise<void> {
  const version =
    (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (version > 1) throw new Error('数据来自更新版本，请先升级应用。现有数据未被修改。');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  if (version === 0)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(`CREATE TABLE birthdays (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 30),
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 30),
      isLeap INTEGER NOT NULL CHECK(isLeap IN (0, 1)),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    ); CREATE INDEX birthdays_created ON birthdays(createdAt, id);
    PRAGMA user_version = 1;`);
    });
}
function fromStored(row: StoredBirthday): Birthday {
  if (row.isLeap !== 0 && row.isLeap !== 1) throw new Error('生日数据无效，未对数据库进行修改');
  const draft = normalizeDraft({ ...row, isLeap: row.isLeap === 1 });
  return { ...row, ...draft };
}

export class SqliteBirthdayRepository implements BirthdayRepository {
  private database: SqlDatabase | null = null;
  private opening: Promise<void> | null = null;
  constructor(
    private open: () => Promise<SqlDatabase>,
    private id: () => string,
    private now = () => new Date(),
  ) {}
  async initialize(): Promise<void> {
    if (this.database) return;
    if (!this.opening)
      this.opening = (async () => {
        const db = await this.open();
        try {
          await migrateDatabase(db);
          this.database = db;
        } catch (error) {
          await db.closeAsync();
          throw error;
        }
      })().finally(() => {
        this.opening = null;
      });
    return this.opening;
  }
  private async db(): Promise<SqlDatabase> {
    await this.initialize();
    return this.database!;
  }
  async list(): Promise<Birthday[]> {
    return (
      await (await this.db()).getAllAsync<StoredBirthday>('SELECT * FROM birthdays ORDER BY createdAt, id')
    ).map(fromStored);
  }
  async create(input: BirthdayDraft): Promise<Birthday> {
    const draft = normalizeDraft(input);
    const stamp = this.now().toISOString();
    const row = { ...draft, id: this.id(), createdAt: stamp, updatedAt: stamp };
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        'INSERT INTO birthdays (id,name,month,day,isLeap,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',
        row.id,
        row.name,
        row.month,
        row.day,
        Number(row.isLeap),
        row.createdAt,
        row.updatedAt,
      );
    });
    return row;
  }
  async update(id: string, input: BirthdayDraft): Promise<Birthday> {
    const draft = normalizeDraft(input);
    let updated: Birthday | undefined;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const previous = await tx.getFirstAsync<StoredBirthday>('SELECT * FROM birthdays WHERE id = ?', id);
      if (!previous) throw new Error('这条生日已不存在，请返回生日簿刷新');
      updated = { ...fromStored(previous), ...draft, updatedAt: this.now().toISOString() };
      await tx.runAsync(
        'UPDATE birthdays SET name=?,month=?,day=?,isLeap=?,updatedAt=? WHERE id=?',
        draft.name,
        draft.month,
        draft.day,
        Number(draft.isLeap),
        updated.updatedAt,
        id,
      );
    });
    return updated!;
  }
  async remove(id: string): Promise<void> {
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const result = await tx.runAsync('DELETE FROM birthdays WHERE id=?', id);
      if (result.changes !== 1) throw new Error('这条生日已不存在，请返回生日簿刷新');
    });
  }
  async close(): Promise<void> {
    await this.opening;
    await this.database?.closeAsync();
    this.database = null;
  }
}
