import { Dexie, type Table } from 'dexie';
import { type Birthday, type BirthdayDraft, type BirthdayRepository, normalizeDraft } from '../core/birthday';

export class WebBirthdayRepository implements BirthdayRepository {
  private db: Dexie;
  private birthdays: Table<Birthday, string>;
  constructor(
    name = 'suisui-calendar',
    private id: () => string = () => crypto.randomUUID(),
    private now = () => new Date(),
  ) {
    this.db = new Dexie(name);
    this.db.version(1).stores({ birthdays: 'id,createdAt' });
    this.birthdays = this.db.table('birthdays');
  }
  async initialize(): Promise<void> {
    await this.db.open();
    // Dexie keeps the declared verno on downgrade-compatible opens; native IDB
    // exposes the actual version, using Dexie's documented factor of ten.
    if (this.db.backendDB().version > 10) {
      this.db.close();
      throw new Error('数据来自更新版本，请先升级应用。现有数据未被修改。');
    }
  }
  async list(): Promise<Birthday[]> {
    await this.initialize();
    const rows = await this.birthdays.orderBy('createdAt').toArray();
    return rows.map((row) => ({ ...row, ...normalizeDraft(row) }));
  }
  async create(input: BirthdayDraft): Promise<Birthday> {
    const draft = normalizeDraft(input);
    const stamp = this.now().toISOString();
    const row = { ...draft, id: this.id(), createdAt: stamp, updatedAt: stamp };
    await this.initialize();
    await this.birthdays.add(row);
    return row;
  }
  async update(id: string, input: BirthdayDraft): Promise<Birthday> {
    const draft = normalizeDraft(input);
    await this.initialize();
    return this.db.transaction('rw', this.birthdays, async () => {
      const old = await this.birthdays.get(id);
      if (!old) throw new Error('这条生日已不存在，请返回生日簿刷新');
      const row = { ...old, ...draft, updatedAt: this.now().toISOString() };
      await this.birthdays.put(row);
      return row;
    });
  }
  async remove(id: string): Promise<void> {
    await this.initialize();
    await this.db.transaction('rw', this.birthdays, async () => {
      if (!(await this.birthdays.get(id))) throw new Error('这条生日已不存在，请返回生日簿刷新');
      await this.birthdays.delete(id);
    });
  }
  async close(): Promise<void> {
    this.db.close();
  }
}
