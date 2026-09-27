import type { Birthday, BirthdayDraft } from '../core/birthday';
import { normalizeDraft } from '../core/birthday';
import type { Countup, CountupDisplayMode, CountupDraft } from '../core/countup';
import { normalizeCountupDraft } from '../core/countup';
import {
  GUEST_OWNER,
  itemFingerprint,
  itemType,
  isAccountOwner,
  type CalendarItem,
  type ItemType,
  type RemoteItem,
  type SyncBirthdayRepository,
  type SyncConflict,
  type SyncMutation,
} from '../sync/model';

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
  ownerKey: string;
  id: string;
  itemType: ItemType;
  name: string;
  createdAt: string;
  updatedAt: string;
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeap: number | null;
  solarMonth: number | null;
  solarDay: number | null;
  birthYear: number | null;
  startDate: string | null;
  note: string;
  displayMode: CountupDisplayMode;
  remoteVersion: number;
  deletedAt: string | null;
};

type StoredMutation = {
  ownerKey: string;
  birthdayId: string;
  itemType: ItemType;
  operationId: string;
  kind: 'upsert' | 'delete';
  baseVersion: number;
  payload: string | null;
  createdAt: string;
};

type StoredConflict = {
  ownerKey: string;
  birthdayId: string;
  itemType: ItemType;
  localPayload: string | null;
  remotePayload: string;
  createdAt: string;
};

const birthdayColumnsV4 = `ownerKey,id,itemType,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,startDate,note,
  createdAt,updatedAt,remoteVersion,deletedAt`;

const birthdayColumnsV5 = `ownerKey,id,itemType,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,startDate,note,displayMode,
  createdAt,updatedAt,remoteVersion,deletedAt`;

const birthdayColumns = `ownerKey,id,itemType,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,birthYear,startDate,note,displayMode,
  createdAt,updatedAt,remoteVersion,deletedAt`;

const legacyBirthdayColumns = `ownerKey,id,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,
  createdAt,updatedAt,remoteVersion,deletedAt`;

function birthdayTable(name: string): string {
  return `CREATE TABLE ${name} (
    ownerKey TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 30),
    lunarMonth INTEGER,
    lunarDay INTEGER,
    isLeap INTEGER,
    solarMonth INTEGER,
    solarDay INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    remoteVersion INTEGER NOT NULL DEFAULT 0 CHECK(remoteVersion >= 0),
    deletedAt TEXT,
    PRIMARY KEY(ownerKey,id),
    CHECK((lunarMonth IS NULL AND lunarDay IS NULL AND isLeap IS NULL) OR
      (lunarMonth IS NOT NULL AND lunarDay IS NOT NULL AND isLeap IS NOT NULL AND
       lunarMonth BETWEEN 1 AND 12 AND lunarDay BETWEEN 1 AND 30 AND isLeap IN (0,1))),
    CHECK((solarMonth IS NULL AND solarDay IS NULL) OR
      (solarMonth IS NOT NULL AND solarDay IS NOT NULL AND solarMonth BETWEEN 1 AND 12 AND
       solarDay BETWEEN 1 AND CASE WHEN solarMonth=2 THEN 29 WHEN solarMonth IN (4,6,9,11) THEN 30 ELSE 31 END)),
    CHECK(lunarMonth IS NOT NULL OR solarMonth IS NOT NULL)
  );`;
}

function calendarItemTable(name: string, includeDisplayMode = true, includeBirthYear = false): string {
  return `CREATE TABLE ${name} (
    ownerKey TEXT NOT NULL,
    id TEXT NOT NULL,
    itemType TEXT NOT NULL CHECK(itemType IN ('birthday','countup')),
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 30),
    lunarMonth INTEGER,
    lunarDay INTEGER,
    isLeap INTEGER,
    solarMonth INTEGER,
    solarDay INTEGER,
    ${includeBirthYear ? 'birthYear INTEGER,' : ''}
    startDate TEXT,
    note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 120),
    ${includeDisplayMode ? "displayMode TEXT NOT NULL DEFAULT 'days' CHECK(displayMode IN ('days','anniversary'))," : ''}
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    remoteVersion INTEGER NOT NULL DEFAULT 0 CHECK(remoteVersion >= 0),
    deletedAt TEXT,
    PRIMARY KEY(ownerKey,id),
    CHECK(
      (itemType='birthday' ${includeDisplayMode ? "AND displayMode='days'" : ''} ${includeBirthYear ? 'AND (birthYear IS NULL OR birthYear BETWEEN 1901 AND 2100)' : ''} AND startDate IS NULL AND
        ((lunarMonth IS NULL AND lunarDay IS NULL AND isLeap IS NULL) OR
          (lunarMonth IS NOT NULL AND lunarDay IS NOT NULL AND isLeap IS NOT NULL AND
           lunarMonth BETWEEN 1 AND 12 AND lunarDay BETWEEN 1 AND 30 AND isLeap IN (0,1))) AND
        ((solarMonth IS NULL AND solarDay IS NULL) OR
          (solarMonth IS NOT NULL AND solarDay IS NOT NULL AND solarMonth BETWEEN 1 AND 12 AND
           solarDay BETWEEN 1 AND CASE WHEN solarMonth=2 THEN 29 WHEN solarMonth IN (4,6,9,11) THEN 30 ELSE 31 END)) AND
        (lunarMonth IS NOT NULL OR solarMonth IS NOT NULL))
      OR
      (itemType='countup' ${includeBirthYear ? 'AND birthYear IS NULL' : ''} AND startDate IS NOT NULL AND
        lunarMonth IS NULL AND lunarDay IS NULL AND isLeap IS NULL AND solarMonth IS NULL AND solarDay IS NULL)
    )
  );`;
}

export async function migrateDatabase(db: SqlDatabase): Promise<void> {
  const version =
    (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (version > 6) throw new Error('数据来自更新版本，请先升级应用。现有数据未被修改。');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  if (version < 2)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(`CREATE TABLE birthdays_v2 (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 30),
        lunarMonth INTEGER,lunarDay INTEGER,isLeap INTEGER,solarMonth INTEGER,solarDay INTEGER,
        createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,
        CHECK((lunarMonth IS NULL AND lunarDay IS NULL AND isLeap IS NULL) OR
          (lunarMonth IS NOT NULL AND lunarDay IS NOT NULL AND isLeap IS NOT NULL AND
           lunarMonth BETWEEN 1 AND 12 AND lunarDay BETWEEN 1 AND 30 AND isLeap IN (0,1))),
        CHECK((solarMonth IS NULL AND solarDay IS NULL) OR
          (solarMonth IS NOT NULL AND solarDay IS NOT NULL AND solarMonth BETWEEN 1 AND 12 AND
           solarDay BETWEEN 1 AND CASE WHEN solarMonth=2 THEN 29 WHEN solarMonth IN (4,6,9,11) THEN 30 ELSE 31 END)),
        CHECK(lunarMonth IS NOT NULL OR solarMonth IS NOT NULL)
      );`);
      if (version === 1)
        await tx.execAsync(`INSERT INTO birthdays_v2 (id,name,lunarMonth,lunarDay,isLeap,createdAt,updatedAt)
          SELECT id,name,month,day,isLeap,createdAt,updatedAt FROM birthdays;
          DROP TABLE birthdays;`);
      await tx.execAsync(`ALTER TABLE birthdays_v2 RENAME TO birthdays;
        CREATE INDEX birthdays_created ON birthdays(createdAt,id);
        PRAGMA user_version=2;`);
    });
  if (version < 3)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(birthdayTable('birthdays_v3'));
      await tx.execAsync(`INSERT INTO birthdays_v3
        (${legacyBirthdayColumns})
        SELECT '${GUEST_OWNER}',id,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,
          createdAt,updatedAt,0,NULL FROM birthdays;
        DROP TABLE birthdays;
        ALTER TABLE birthdays_v3 RENAME TO birthdays;
        CREATE INDEX birthdays_owner_created ON birthdays(ownerKey,createdAt,id);
        CREATE TABLE sync_outbox (
          ownerKey TEXT NOT NULL,birthdayId TEXT NOT NULL,operationId TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN ('upsert','delete')),baseVersion INTEGER NOT NULL CHECK(baseVersion >= 0),
          payload TEXT,createdAt TEXT NOT NULL,PRIMARY KEY(ownerKey,birthdayId)
        );
        CREATE UNIQUE INDEX sync_outbox_operation ON sync_outbox(ownerKey,operationId);
        CREATE TABLE sync_conflicts (
          ownerKey TEXT NOT NULL,birthdayId TEXT NOT NULL,localPayload TEXT,remotePayload TEXT NOT NULL,
          createdAt TEXT NOT NULL,PRIMARY KEY(ownerKey,birthdayId)
        );
        PRAGMA user_version=3;`);
    });
  if (version < 4)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(calendarItemTable('calendar_items_v4', false));
      await tx.execAsync(`INSERT INTO calendar_items_v4 (${birthdayColumnsV4})
        SELECT ownerKey,id,'birthday',name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,NULL,'',
          createdAt,updatedAt,remoteVersion,deletedAt FROM birthdays;
        DROP TABLE birthdays;
        ALTER TABLE calendar_items_v4 RENAME TO birthdays;
        CREATE INDEX birthdays_owner_created ON birthdays(ownerKey,createdAt,id);
        ALTER TABLE sync_outbox ADD COLUMN itemType TEXT NOT NULL DEFAULT 'birthday'
          CHECK(itemType IN ('birthday','countup'));
        ALTER TABLE sync_conflicts ADD COLUMN itemType TEXT NOT NULL DEFAULT 'birthday'
          CHECK(itemType IN ('birthday','countup'));
        PRAGMA user_version=4;`);
    });
  if (version < 5)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(calendarItemTable('calendar_items_v5'));
      await tx.execAsync(`INSERT INTO calendar_items_v5 (${birthdayColumnsV5})
        SELECT ownerKey,id,itemType,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,startDate,note,'days',
          createdAt,updatedAt,remoteVersion,deletedAt FROM birthdays;
        DROP TABLE birthdays;
        ALTER TABLE calendar_items_v5 RENAME TO birthdays;
        CREATE INDEX birthdays_owner_created ON birthdays(ownerKey,createdAt,id);
        PRAGMA user_version=5;`);
    });
  if (version < 6)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(calendarItemTable('calendar_items_v6', true, true));
      await tx.execAsync(`INSERT INTO calendar_items_v6 (${birthdayColumns})
        SELECT ownerKey,id,itemType,name,lunarMonth,lunarDay,isLeap,solarMonth,solarDay,NULL,startDate,note,displayMode,
          createdAt,updatedAt,remoteVersion,deletedAt FROM birthdays;
        DROP TABLE birthdays;
        ALTER TABLE calendar_items_v6 RENAME TO birthdays;
        CREATE INDEX birthdays_owner_created ON birthdays(ownerKey,createdAt,id);
        PRAGMA user_version=6;`);
    });
}

function toBirthday(row: StoredBirthday): Birthday {
  if (row.itemType !== 'birthday') throw new Error('事项类型无效，未对数据库进行修改');
  if (row.isLeap !== null && row.isLeap !== 0 && row.isLeap !== 1)
    throw new Error('生日数据无效，未对数据库进行修改');
  const draft = normalizeDraft({
    name: row.name,
    lunar:
      row.lunarMonth === null ? null : { month: row.lunarMonth, day: row.lunarDay, isLeap: row.isLeap === 1 },
    solar: row.solarMonth === null ? null : { month: row.solarMonth, day: row.solarDay },
    birthYear: row.birthYear,
  });
  return { ...draft, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function toCountup(row: StoredBirthday): Countup {
  if (row.itemType !== 'countup') throw new Error('事项类型无效，未对数据库进行修改');
  const draft = normalizeCountupDraft({
    type: 'countup',
    title: row.name,
    startDate: row.startDate,
    note: row.note,
    displayMode: row.displayMode ?? 'days',
  });
  return { ...draft, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function toItem(row: StoredBirthday): CalendarItem {
  return row.itemType === 'countup' ? toCountup(row) : toBirthday(row);
}

function birthdayParams(
  ownerKey: string,
  row: CalendarItem,
  remoteVersion = 0,
  deletedAt: string | null = null,
) {
  const countup = itemType(row) === 'countup' ? (row as Countup) : null;
  const birthday = countup ? null : (row as Birthday);
  return [
    ownerKey,
    row.id,
    itemType(row),
    countup?.title ?? birthday!.name,
    birthday?.lunar?.month ?? null,
    birthday?.lunar?.day ?? null,
    birthday?.lunar ? Number(birthday.lunar.isLeap) : null,
    birthday?.solar?.month ?? null,
    birthday?.solar?.day ?? null,
    birthday?.birthYear ?? null,
    countup?.startDate ?? null,
    countup?.note ?? '',
    countup?.displayMode ?? 'days',
    row.createdAt,
    row.updatedAt,
    remoteVersion,
    deletedAt,
  ] satisfies Param[];
}

async function putBirthday(
  tx: SqlDatabase,
  ownerKey: string,
  row: CalendarItem,
  remoteVersion = 0,
  deletedAt: string | null = null,
) {
  await tx.runAsync(
    `INSERT INTO birthdays (${birthdayColumns}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(ownerKey,id) DO UPDATE SET
      itemType=excluded.itemType,name=excluded.name,lunarMonth=excluded.lunarMonth,lunarDay=excluded.lunarDay,isLeap=excluded.isLeap,
      solarMonth=excluded.solarMonth,solarDay=excluded.solarDay,birthYear=excluded.birthYear,startDate=excluded.startDate,note=excluded.note,displayMode=excluded.displayMode,createdAt=excluded.createdAt,
      updatedAt=excluded.updatedAt,remoteVersion=excluded.remoteVersion,deletedAt=excluded.deletedAt`,
    ...birthdayParams(ownerKey, row, remoteVersion, deletedAt),
  );
}

function parseMutation(row: StoredMutation): SyncMutation {
  return { ...row, payload: row.payload ? (JSON.parse(row.payload) as CalendarItem) : null };
}

export class SqliteBirthdayRepository implements SyncBirthdayRepository {
  private database: SqlDatabase | null = null;
  private opening: Promise<void> | null = null;
  private ownerKey = GUEST_OWNER;

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
      })().finally(() => (this.opening = null));
    return this.opening;
  }

  private async db(): Promise<SqlDatabase> {
    await this.initialize();
    return this.database!;
  }

  async setOwner(ownerKey: string): Promise<void> {
    if (ownerKey !== GUEST_OWNER && !isAccountOwner(ownerKey)) throw new Error('账号数据范围无效');
    await this.initialize();
    this.ownerKey = ownerKey;
  }

  getOwner(): string {
    return this.ownerKey;
  }

  async list(): Promise<Birthday[]> {
    const ownerKey = this.ownerKey;
    const rows = await (
      await this.db()
    ).getAllAsync<StoredBirthday>(
      "SELECT * FROM birthdays WHERE ownerKey=? AND itemType='birthday' AND deletedAt IS NULL ORDER BY createdAt,id",
      ownerKey,
    );
    return rows.map(toBirthday);
  }

  async create(input: BirthdayDraft): Promise<Birthday> {
    const ownerKey = this.ownerKey;
    const draft = normalizeDraft(input);
    const stamp = this.now().toISOString();
    const row = { ...draft, id: this.id(), createdAt: stamp, updatedAt: stamp };
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      await putBirthday(tx, ownerKey, row);
      if (isAccountOwner(ownerKey)) await this.queue(tx, row, 'upsert', 0, ownerKey);
    });
    return row;
  }

  async update(id: string, input: BirthdayDraft): Promise<Birthday> {
    const ownerKey = this.ownerKey;
    const draft = normalizeDraft(input);
    let updated: Birthday | undefined;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const previous = await tx.getFirstAsync<StoredBirthday>(
        "SELECT * FROM birthdays WHERE ownerKey=? AND id=? AND itemType='birthday' AND deletedAt IS NULL",
        ownerKey,
        id,
      );
      if (!previous) throw new Error('这条生日已不存在，请返回生日簿刷新');
      updated = { ...toBirthday(previous), ...draft, updatedAt: this.now().toISOString() };
      await putBirthday(tx, ownerKey, updated, previous.remoteVersion);
      if (isAccountOwner(ownerKey)) await this.queue(tx, updated, 'upsert', previous.remoteVersion, ownerKey);
    });
    return updated!;
  }

  async remove(id: string): Promise<void> {
    const ownerKey = this.ownerKey;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const previous = await tx.getFirstAsync<StoredBirthday>(
        "SELECT * FROM birthdays WHERE ownerKey=? AND id=? AND itemType='birthday' AND deletedAt IS NULL",
        ownerKey,
        id,
      );
      if (!previous) throw new Error('这条生日已不存在，请返回生日簿刷新');
      if (!isAccountOwner(ownerKey) || previous.remoteVersion === 0) {
        await tx.runAsync('DELETE FROM sync_outbox WHERE ownerKey=? AND birthdayId=?', ownerKey, id);
        await tx.runAsync('DELETE FROM birthdays WHERE ownerKey=? AND id=?', ownerKey, id);
        return;
      }
      const deletedAt = this.now().toISOString();
      await tx.runAsync(
        'UPDATE birthdays SET deletedAt=?,updatedAt=? WHERE ownerKey=? AND id=?',
        deletedAt,
        deletedAt,
        ownerKey,
        id,
      );
      await this.queue(
        tx,
        { ...toBirthday(previous), updatedAt: deletedAt },
        'delete',
        previous.remoteVersion,
        ownerKey,
      );
    });
  }

  async listCountups(): Promise<Countup[]> {
    const ownerKey = this.ownerKey;
    const rows = await (
      await this.db()
    ).getAllAsync<StoredBirthday>(
      "SELECT * FROM birthdays WHERE ownerKey=? AND itemType='countup' AND deletedAt IS NULL ORDER BY createdAt,id",
      ownerKey,
    );
    return rows.map(toCountup);
  }

  async createCountup(input: CountupDraft): Promise<Countup> {
    const ownerKey = this.ownerKey;
    const draft = normalizeCountupDraft(input);
    const stamp = this.now().toISOString();
    const row = { ...draft, id: this.id(), createdAt: stamp, updatedAt: stamp };
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      await putBirthday(tx, ownerKey, row);
      if (isAccountOwner(ownerKey)) await this.queue(tx, row, 'upsert', 0, ownerKey);
    });
    return row;
  }

  async updateCountup(id: string, input: CountupDraft): Promise<Countup> {
    const ownerKey = this.ownerKey;
    const draft = normalizeCountupDraft(input);
    let updated: Countup | undefined;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const previous = await tx.getFirstAsync<StoredBirthday>(
        "SELECT * FROM birthdays WHERE ownerKey=? AND id=? AND itemType='countup' AND deletedAt IS NULL",
        ownerKey,
        id,
      );
      if (!previous) throw new Error('这条时光记已不存在，请返回时光记列表刷新');
      updated = { ...toCountup(previous), ...draft, updatedAt: this.now().toISOString() };
      await putBirthday(tx, ownerKey, updated, previous.remoteVersion);
      if (isAccountOwner(ownerKey)) await this.queue(tx, updated, 'upsert', previous.remoteVersion, ownerKey);
    });
    return updated!;
  }

  async removeCountup(id: string): Promise<void> {
    const ownerKey = this.ownerKey;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const previous = await tx.getFirstAsync<StoredBirthday>(
        "SELECT * FROM birthdays WHERE ownerKey=? AND id=? AND itemType='countup' AND deletedAt IS NULL",
        ownerKey,
        id,
      );
      if (!previous) throw new Error('这条时光记已不存在，请返回时光记列表刷新');
      if (!isAccountOwner(ownerKey) || previous.remoteVersion === 0) {
        await tx.runAsync('DELETE FROM sync_outbox WHERE ownerKey=? AND birthdayId=?', ownerKey, id);
        await tx.runAsync('DELETE FROM birthdays WHERE ownerKey=? AND id=?', ownerKey, id);
        return;
      }
      const deletedAt = this.now().toISOString();
      await tx.runAsync(
        'UPDATE birthdays SET deletedAt=?,updatedAt=? WHERE ownerKey=? AND id=?',
        deletedAt,
        deletedAt,
        ownerKey,
        id,
      );
      await this.queue(
        tx,
        { ...toCountup(previous), updatedAt: deletedAt },
        'delete',
        previous.remoteVersion,
        ownerKey,
      );
    });
  }

  private async queue(
    tx: SqlDatabase,
    row: CalendarItem,
    kind: SyncMutation['kind'],
    baseVersion: number,
    ownerKey: string,
  ) {
    const existing = await tx.getFirstAsync<StoredMutation>(
      'SELECT * FROM sync_outbox WHERE ownerKey=? AND birthdayId=?',
      ownerKey,
      row.id,
    );
    await tx.runAsync(
      `INSERT INTO sync_outbox (ownerKey,birthdayId,itemType,operationId,kind,baseVersion,payload,createdAt)
       VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(ownerKey,birthdayId) DO UPDATE SET
       itemType=excluded.itemType,operationId=excluded.operationId,kind=excluded.kind,baseVersion=excluded.baseVersion,
       payload=excluded.payload,createdAt=excluded.createdAt`,
      ownerKey,
      row.id,
      itemType(row),
      this.id(),
      kind,
      existing?.baseVersion ?? baseVersion,
      kind === 'upsert' ? JSON.stringify(row) : null,
      this.now().toISOString(),
    );
  }

  async pending(): Promise<SyncMutation[]> {
    const ownerKey = this.ownerKey;
    return (
      await (
        await this.db()
      ).getAllAsync<StoredMutation>(
        'SELECT * FROM sync_outbox WHERE ownerKey=? ORDER BY createdAt,birthdayId',
        ownerKey,
      )
    ).map(parseMutation);
  }

  async acknowledge(mutation: SyncMutation, remote: RemoteItem): Promise<void> {
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const current = await tx.getFirstAsync<StoredMutation>(
        'SELECT * FROM sync_outbox WHERE ownerKey=? AND birthdayId=?',
        mutation.ownerKey,
        mutation.birthdayId,
      );
      if (!current) return;
      if (current.operationId === mutation.operationId) {
        await putBirthday(tx, mutation.ownerKey, remote, remote.version, remote.deletedAt);
        await tx.runAsync(
          'DELETE FROM sync_outbox WHERE ownerKey=? AND birthdayId=?',
          mutation.ownerKey,
          mutation.birthdayId,
        );
      } else {
        await tx.runAsync(
          'UPDATE birthdays SET remoteVersion=? WHERE ownerKey=? AND id=?',
          remote.version,
          mutation.ownerKey,
          mutation.birthdayId,
        );
        await tx.runAsync(
          'UPDATE sync_outbox SET baseVersion=? WHERE ownerKey=? AND birthdayId=?',
          remote.version,
          mutation.ownerKey,
          mutation.birthdayId,
        );
      }
    });
  }

  async mergeRemote(records: RemoteItem[], ownerKey: string): Promise<number> {
    if (this.ownerKey !== ownerKey) return 0;
    let changed = 0;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      for (const remote of records) {
        const local = await tx.getFirstAsync<StoredBirthday>(
          'SELECT * FROM birthdays WHERE ownerKey=? AND id=?',
          ownerKey,
          remote.id,
        );
        const pending = await tx.getFirstAsync<StoredMutation>(
          'SELECT * FROM sync_outbox WHERE ownerKey=? AND birthdayId=?',
          ownerKey,
          remote.id,
        );
        if (pending) {
          if (remote.version > pending.baseVersion) {
            await this.storeConflict(tx, pending, remote, local);
            changed++;
          }
          continue;
        }
        if (!local || local.remoteVersion !== remote.version) {
          await putBirthday(tx, ownerKey, remote, remote.version, remote.deletedAt);
          changed++;
        }
      }
    });
    return changed;
  }

  async recordConflict(mutation: SyncMutation, remote: RemoteItem): Promise<void> {
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const stored = await tx.getFirstAsync<StoredMutation>(
        'SELECT * FROM sync_outbox WHERE ownerKey=? AND birthdayId=? AND operationId=?',
        mutation.ownerKey,
        mutation.birthdayId,
        mutation.operationId,
      );
      if (!stored) return;
      const local = await tx.getFirstAsync<StoredBirthday>(
        'SELECT * FROM birthdays WHERE ownerKey=? AND id=?',
        mutation.ownerKey,
        mutation.birthdayId,
      );
      await this.storeConflict(tx, stored, remote, local);
    });
  }

  private async storeConflict(
    tx: SqlDatabase,
    mutation: StoredMutation,
    remote: RemoteItem,
    local: StoredBirthday | null,
  ) {
    await tx.runAsync(
      `INSERT INTO sync_conflicts (ownerKey,birthdayId,itemType,localPayload,remotePayload,createdAt)
       VALUES (?,?,?,?,?,?) ON CONFLICT(ownerKey,birthdayId) DO UPDATE SET
       itemType=excluded.itemType,localPayload=excluded.localPayload,
       remotePayload=excluded.remotePayload,createdAt=excluded.createdAt`,
      mutation.ownerKey,
      mutation.birthdayId,
      mutation.itemType,
      local && !local.deletedAt ? JSON.stringify(toItem(local)) : null,
      JSON.stringify(remote),
      this.now().toISOString(),
    );
    await tx.runAsync(
      'DELETE FROM sync_outbox WHERE ownerKey=? AND birthdayId=?',
      mutation.ownerKey,
      mutation.birthdayId,
    );
  }

  async conflicts(): Promise<SyncConflict[]> {
    const ownerKey = this.ownerKey;
    return (
      await (
        await this.db()
      ).getAllAsync<StoredConflict>(
        'SELECT * FROM sync_conflicts WHERE ownerKey=? ORDER BY createdAt,birthdayId',
        ownerKey,
      )
    ).map((row) => ({
      ownerKey: row.ownerKey,
      birthdayId: row.birthdayId,
      itemType: row.itemType,
      local: row.localPayload ? (JSON.parse(row.localPayload) as CalendarItem) : null,
      remote: JSON.parse(row.remotePayload) as RemoteItem,
      createdAt: row.createdAt,
    }));
  }

  async resolveConflict(birthdayId: string, choice: 'local' | 'remote'): Promise<void> {
    const ownerKey = this.ownerKey;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const conflict = await tx.getFirstAsync<StoredConflict>(
        'SELECT * FROM sync_conflicts WHERE ownerKey=? AND birthdayId=?',
        ownerKey,
        birthdayId,
      );
      if (!conflict) throw new Error('这条同步冲突已不存在');
      const remote = JSON.parse(conflict.remotePayload) as RemoteItem;
      if (choice === 'remote') {
        await putBirthday(tx, ownerKey, remote, remote.version, remote.deletedAt);
      } else {
        const local = conflict.localPayload ? (JSON.parse(conflict.localPayload) as CalendarItem) : null;
        const value = local ?? remote;
        await putBirthday(tx, ownerKey, value, remote.version, local ? null : this.now().toISOString());
        await this.queue(tx, value, local ? 'upsert' : 'delete', remote.version, ownerKey);
      }
      await tx.runAsync('DELETE FROM sync_conflicts WHERE ownerKey=? AND birthdayId=?', ownerKey, birthdayId);
    });
  }

  async guestCount(): Promise<number> {
    return (
      (
        await (
          await this.db()
        ).getFirstAsync<{ count: number }>(
          'SELECT count(*) AS count FROM birthdays WHERE ownerKey=? AND deletedAt IS NULL',
          GUEST_OWNER,
        )
      )?.count ?? 0
    );
  }

  async importGuest(): Promise<{ imported: number; skipped: number }> {
    const ownerKey = this.ownerKey;
    if (!isAccountOwner(ownerKey)) throw new Error('请先登录再合并本机事项');
    let imported = 0;
    let skipped = 0;
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      const guests = await tx.getAllAsync<StoredBirthday>(
        'SELECT * FROM birthdays WHERE ownerKey=? AND deletedAt IS NULL ORDER BY createdAt,id',
        GUEST_OWNER,
      );
      const accountRows = await tx.getAllAsync<StoredBirthday>(
        'SELECT * FROM birthdays WHERE ownerKey=? AND deletedAt IS NULL',
        ownerKey,
      );
      const fingerprints = new Set(accountRows.map((row) => itemFingerprint(toItem(row))));
      const ids = new Set(accountRows.map((row) => row.id));
      for (const guest of guests) {
        const source = toItem(guest);
        const fingerprint = itemFingerprint(source);
        if (fingerprints.has(fingerprint)) {
          skipped++;
          continue;
        }
        const row = { ...source, id: ids.has(source.id) ? this.id() : source.id };
        await putBirthday(tx, ownerKey, row);
        await this.queue(tx, row, 'upsert', 0, ownerKey);
        ids.add(row.id);
        fingerprints.add(fingerprint);
        imported++;
      }
    });
    return { imported, skipped };
  }

  async clearGuest(): Promise<void> {
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM birthdays WHERE ownerKey=?', GUEST_OWNER);
      await tx.runAsync('DELETE FROM sync_outbox WHERE ownerKey=?', GUEST_OWNER);
      await tx.runAsync('DELETE FROM sync_conflicts WHERE ownerKey=?', GUEST_OWNER);
    });
  }

  async clearOwner(ownerKey: string): Promise<void> {
    if (!isAccountOwner(ownerKey)) throw new Error('只能清理账号缓存');
    await (
      await this.db()
    ).withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM birthdays WHERE ownerKey=?', ownerKey);
      await tx.runAsync('DELETE FROM sync_outbox WHERE ownerKey=?', ownerKey);
      await tx.runAsync('DELETE FROM sync_conflicts WHERE ownerKey=?', ownerKey);
    });
  }

  async close(): Promise<void> {
    await this.opening;
    await this.database?.closeAsync();
    this.database = null;
  }
}
