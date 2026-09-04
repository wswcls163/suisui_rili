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
type StoredBirthday = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeap: number | null;
  solarMonth: number | null;
  solarDay: number | null;
};
export async function migrateDatabase(db: SqlDatabase): Promise<void> {
  const version =
    (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (version > 2) throw new Error('数据来自更新版本，请先升级应用。现有数据未被修改。');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  if (version < 2)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(`CREATE TABLE birthdays_v2 (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 30),
      lunarMonth INTEGER,
      lunarDay INTEGER,
      isLeap INTEGER,
      solarMonth INTEGER,
      solarDay INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      CHECK((lunarMonth IS NULL AND lunarDay IS NULL AND isLeap IS NULL) OR
        (lunarMonth IS NOT NULL AND lunarDay IS NOT NULL AND isLeap IS NOT NULL AND
         lunarMonth BETWEEN 1 AND 12 AND lunarDay BETWEEN 1 AND 30 AND isLeap IN (0, 1))),
      CHECK((solarMonth IS NULL AND solarDay IS NULL) OR
        (solarMonth IS NOT NULL AND solarDay IS NOT NULL AND solarMonth BETWEEN 1 AND 12 AND
         solarDay BETWEEN 1 AND CASE WHEN solarMonth = 2 THEN 29 WHEN solarMonth IN (4,6,9,11) THEN 30 ELSE 31 END)),
      CHECK(lunarMonth IS NOT NULL OR solarMonth IS NOT NULL)
    );`);
      if (version === 1)
        await tx.execAsync(`
        INSERT INTO birthdays_v2 (id,name,lunarMonth,lunarDay,isLeap,createdAt,updatedAt)
        SELECT id,name,month,day,isLeap,createdAt,updatedAt FROM birthdays;
        DROP TABLE birthdays;`);
      await tx.execAsync(`ALTER TABLE birthdays_v2 RENAME TO birthdays;
        CREATE INDEX birthdays_created ON birthdays(createdAt, id);
        PRAGMA user_version = 2;`);
    });
}
function fromStored(row: StoredBirthday): Birthday {
  if (row.isLeap !== null && row.isLeap !== 0 && row.isLeap !== 1)
    throw new Error('生日数据无效，未对数据库进行修改');
  const draft = normalizeDraft({
    name: row.name,
    lunar:
      row.lunarMonth === null ? null : { month: row.lunarMonth, day: row.lunarDay, isLeap: row.isLeap === 1 },
    solar: row.solarMonth === null ? null : { month: row.solarMonth, day: row.solarDay },
  });
  return { ...draft, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
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
        'INSERT INTO birthdays (id,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
        row.id,
        row.name,
        row.lunar?.month ?? null,
        row.lunar?.day ?? null,
        row.lunar ? Number(row.lunar.isLeap) : null,
        row.solar?.month ?? null,
        row.solar?.day ?? null,
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
        'UPDATE birthdays SET name=?,lunarMonth=?,lunarDay=?,isLeap=?,solarMonth=?,solarDay=?,updatedAt=? WHERE id=?',
        draft.name,
        draft.lunar?.month ?? null,
        draft.lunar?.day ?? null,
        draft.lunar ? Number(draft.lunar.isLeap) : null,
        draft.solar?.month ?? null,
        draft.solar?.day ?? null,
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
