import { Dexie, type Table } from 'dexie';
import type { Birthday, BirthdayDraft } from '../core/birthday';
import { normalizeDraft } from '../core/birthday';
import {
  birthdayFingerprint,
  GUEST_OWNER,
  isAccountOwner,
  type RemoteBirthday,
  type SyncBirthdayRepository,
  type SyncConflict,
  type SyncMutation,
} from '../sync/model';

type StoredBirthday = Omit<Birthday, 'id'> & {
  id: string;
  birthdayId: string;
  ownerKey: string;
  remoteVersion: number;
  deletedAt: string | null;
};

type StoredMutation = SyncMutation & { storageKey: string; payload: Birthday | null };
type StoredConflict = SyncConflict & { storageKey: string };

function key(ownerKey: string, birthdayId: string): string {
  return `${ownerKey}\u0000${birthdayId}`;
}

function toBirthday(row: StoredBirthday): Birthday {
  return {
    ...normalizeDraft(row),
    id: row.birthdayId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function stored(ownerKey: string, row: Birthday, remoteVersion = 0, deletedAt: string | null = null) {
  return {
    ...row,
    id: key(ownerKey, row.id),
    birthdayId: row.id,
    ownerKey,
    remoteVersion,
    deletedAt,
  } satisfies StoredBirthday;
}

export class WebBirthdayRepository implements SyncBirthdayRepository {
  private db: Dexie;
  private birthdays: Table<StoredBirthday, string>;
  private outbox: Table<StoredMutation, string>;
  private conflictTable: Table<StoredConflict, string>;
  private ownerKey = GUEST_OWNER;

  constructor(
    name = 'suisui-calendar',
    private id: () => string = () => crypto.randomUUID(),
    private now = () => new Date(),
  ) {
    this.db = new Dexie(name);
    this.db.version(1).stores({ birthdays: 'id,createdAt' });
    this.db
      .version(2)
      .stores({ birthdays: 'id,createdAt' })
      .upgrade((tx) =>
        tx
          .table('birthdays')
          .toCollection()
          .modify((row) => {
            Object.assign(
              row,
              normalizeDraft({
                name: row.name,
                lunar: { month: row.month, day: row.day, isLeap: row.isLeap },
                solar: null,
              }),
            );
            delete row.month;
            delete row.day;
            delete row.isLeap;
          }),
      );
    this.db
      .version(3)
      .stores({
        birthdays: 'id,ownerKey,[ownerKey+birthdayId],[ownerKey+createdAt]',
        sync_outbox: 'storageKey,ownerKey,operationId,createdAt',
        sync_conflicts: 'storageKey,ownerKey,createdAt',
      })
      .upgrade((tx) =>
        tx
          .table('birthdays')
          .toCollection()
          .modify((row) => {
            const birthdayId = row.id;
            row.id = key(GUEST_OWNER, birthdayId);
            row.birthdayId = birthdayId;
            row.ownerKey = GUEST_OWNER;
            row.remoteVersion = 0;
            row.deletedAt = null;
          }),
      );
    this.birthdays = this.db.table('birthdays');
    this.outbox = this.db.table('sync_outbox');
    this.conflictTable = this.db.table('sync_conflicts');
  }

  async initialize(): Promise<void> {
    await this.db.open();
    if (this.db.backendDB().version > 30) {
      this.db.close();
      throw new Error('数据来自更新版本，请先升级应用。现有数据未被修改。');
    }
  }

  async setOwner(ownerKey: string): Promise<void> {
    if (ownerKey !== GUEST_OWNER && !isAccountOwner(ownerKey)) throw new Error('账号数据范围无效');
    await this.initialize();
    this.ownerKey = ownerKey;
  }

  getOwner(): string {
    return this.ownerKey;
  }

  private async row(birthdayId: string, ownerKey = this.ownerKey): Promise<StoredBirthday | undefined> {
    return this.birthdays.where('[ownerKey+birthdayId]').equals([ownerKey, birthdayId]).first();
  }

  async list(): Promise<Birthday[]> {
    await this.initialize();
    const rows = await this.birthdays.where('ownerKey').equals(this.ownerKey).sortBy('createdAt');
    return rows.filter((row) => !row.deletedAt).map(toBirthday);
  }

  async create(input: BirthdayDraft): Promise<Birthday> {
    const draft = normalizeDraft(input);
    const stamp = this.now().toISOString();
    const row = { ...draft, id: this.id(), createdAt: stamp, updatedAt: stamp };
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, this.outbox, async () => {
      await this.birthdays.add(stored(this.ownerKey, row));
      if (isAccountOwner(this.ownerKey)) await this.queue(row, 'upsert', 0);
    });
    return row;
  }

  async update(id: string, input: BirthdayDraft): Promise<Birthday> {
    const draft = normalizeDraft(input);
    await this.initialize();
    return this.db.transaction('rw', this.birthdays, this.outbox, async () => {
      const old = await this.row(id);
      if (!old || old.deletedAt) throw new Error('这条生日已不存在，请返回生日簿刷新');
      const row = { ...toBirthday(old), ...draft, updatedAt: this.now().toISOString() };
      await this.birthdays.put(stored(this.ownerKey, row, old.remoteVersion));
      if (isAccountOwner(this.ownerKey)) await this.queue(row, 'upsert', old.remoteVersion);
      return row;
    });
  }

  async remove(id: string): Promise<void> {
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, this.outbox, async () => {
      const old = await this.row(id);
      if (!old || old.deletedAt) throw new Error('这条生日已不存在，请返回生日簿刷新');
      if (!isAccountOwner(this.ownerKey) || old.remoteVersion === 0) {
        await this.outbox.delete(key(this.ownerKey, id));
        await this.birthdays.delete(old.id);
        return;
      }
      const deletedAt = this.now().toISOString();
      await this.birthdays.put({ ...old, updatedAt: deletedAt, deletedAt });
      await this.queue({ ...toBirthday(old), updatedAt: deletedAt }, 'delete', old.remoteVersion);
    });
  }

  private async queue(row: Birthday, kind: SyncMutation['kind'], baseVersion: number) {
    const storageKey = key(this.ownerKey, row.id);
    const existing = await this.outbox.get(storageKey);
    await this.outbox.put({
      storageKey,
      ownerKey: this.ownerKey,
      operationId: this.id(),
      birthdayId: row.id,
      kind,
      baseVersion: existing?.baseVersion ?? baseVersion,
      payload: kind === 'upsert' ? row : null,
      createdAt: this.now().toISOString(),
    });
  }

  async pending(): Promise<SyncMutation[]> {
    await this.initialize();
    const rows = await this.outbox.where('ownerKey').equals(this.ownerKey).sortBy('createdAt');
    return rows.map(({ storageKey: _storageKey, ...row }) => row);
  }

  async acknowledge(mutation: SyncMutation, remote: RemoteBirthday): Promise<void> {
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, this.outbox, async () => {
      const storageKey = key(mutation.ownerKey, mutation.birthdayId);
      const current = await this.outbox.get(storageKey);
      if (!current) return;
      if (current.operationId === mutation.operationId) {
        await this.birthdays.put(stored(mutation.ownerKey, remote, remote.version, remote.deletedAt));
        await this.outbox.delete(storageKey);
      } else {
        const local = await this.row(mutation.birthdayId, mutation.ownerKey);
        if (local) await this.birthdays.put({ ...local, remoteVersion: remote.version });
        await this.outbox.put({ ...current, baseVersion: remote.version });
      }
    });
  }

  async mergeRemote(records: RemoteBirthday[]): Promise<number> {
    await this.initialize();
    let changed = 0;
    await this.db.transaction('rw', this.birthdays, this.outbox, this.conflictTable, async () => {
      for (const remote of records) {
        const storageKey = key(this.ownerKey, remote.id);
        const local = await this.row(remote.id);
        const pending = await this.outbox.get(storageKey);
        if (pending) {
          if (remote.version > pending.baseVersion) {
            await this.storeConflict(pending, remote, local);
            changed++;
          }
          continue;
        }
        if (!local || local.remoteVersion !== remote.version) {
          await this.birthdays.put(stored(this.ownerKey, remote, remote.version, remote.deletedAt));
          changed++;
        }
      }
    });
    return changed;
  }

  async recordConflict(mutation: SyncMutation, remote: RemoteBirthday): Promise<void> {
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, this.outbox, this.conflictTable, async () => {
      const pending = await this.outbox.get(key(mutation.ownerKey, mutation.birthdayId));
      if (!pending || pending.operationId !== mutation.operationId) return;
      await this.storeConflict(pending, remote, await this.row(mutation.birthdayId, mutation.ownerKey));
    });
  }

  private async storeConflict(
    mutation: StoredMutation,
    remote: RemoteBirthday,
    local: StoredBirthday | undefined,
  ) {
    await this.conflictTable.put({
      storageKey: key(mutation.ownerKey, mutation.birthdayId),
      ownerKey: mutation.ownerKey,
      birthdayId: mutation.birthdayId,
      local: local && !local.deletedAt ? toBirthday(local) : null,
      remote,
      createdAt: this.now().toISOString(),
    });
    await this.outbox.delete(mutation.storageKey);
  }

  async conflicts(): Promise<SyncConflict[]> {
    await this.initialize();
    return (await this.conflictTable.where('ownerKey').equals(this.ownerKey).sortBy('createdAt')).map(
      ({ storageKey: _storageKey, ...row }) => row,
    );
  }

  async resolveConflict(birthdayId: string, choice: 'local' | 'remote'): Promise<void> {
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, this.outbox, this.conflictTable, async () => {
      const storageKey = key(this.ownerKey, birthdayId);
      const conflict = await this.conflictTable.get(storageKey);
      if (!conflict) throw new Error('这条同步冲突已不存在');
      if (choice === 'remote') {
        await this.birthdays.put(
          stored(this.ownerKey, conflict.remote, conflict.remote.version, conflict.remote.deletedAt),
        );
      } else {
        const value = conflict.local ?? conflict.remote;
        await this.birthdays.put(
          stored(
            this.ownerKey,
            value,
            conflict.remote.version,
            conflict.local ? null : this.now().toISOString(),
          ),
        );
        await this.queue(value, conflict.local ? 'upsert' : 'delete', conflict.remote.version);
      }
      await this.conflictTable.delete(storageKey);
    });
  }

  async guestCount(): Promise<number> {
    await this.initialize();
    return this.birthdays
      .where('ownerKey')
      .equals(GUEST_OWNER)
      .filter((row) => !row.deletedAt)
      .count();
  }

  async importGuest(): Promise<{ imported: number; skipped: number }> {
    if (!isAccountOwner(this.ownerKey)) throw new Error('请先登录再合并本机生日');
    await this.initialize();
    return this.db.transaction('rw', this.birthdays, this.outbox, async () => {
      const guests = (await this.birthdays.where('ownerKey').equals(GUEST_OWNER).toArray()).filter(
        (row) => !row.deletedAt,
      );
      const accountRows = (await this.birthdays.where('ownerKey').equals(this.ownerKey).toArray()).filter(
        (row) => !row.deletedAt,
      );
      const fingerprints = new Set(accountRows.map((row) => birthdayFingerprint(toBirthday(row))));
      let imported = 0;
      let skipped = 0;
      for (const guest of guests) {
        const source = toBirthday(guest);
        const fingerprint = birthdayFingerprint(source);
        if (fingerprints.has(fingerprint)) {
          skipped++;
          continue;
        }
        const row = { ...source, id: this.id() };
        await this.birthdays.add(stored(this.ownerKey, row));
        await this.queue(row, 'upsert', 0);
        fingerprints.add(fingerprint);
        imported++;
      }
      return { imported, skipped };
    });
  }

  async clearGuest(): Promise<void> {
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, this.outbox, this.conflictTable, async () => {
      await this.birthdays.where('ownerKey').equals(GUEST_OWNER).delete();
      await this.outbox.where('ownerKey').equals(GUEST_OWNER).delete();
      await this.conflictTable.where('ownerKey').equals(GUEST_OWNER).delete();
    });
  }

  async clearOwner(ownerKey: string): Promise<void> {
    if (!isAccountOwner(ownerKey)) throw new Error('只能清理账号缓存');
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, this.outbox, this.conflictTable, async () => {
      await this.birthdays.where('ownerKey').equals(ownerKey).delete();
      await this.outbox.where('ownerKey').equals(ownerKey).delete();
      await this.conflictTable.where('ownerKey').equals(ownerKey).delete();
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
