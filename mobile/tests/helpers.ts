import { type Birthday, type BirthdayDraft, normalizeDraft } from '../src/core/birthday';
import { type Countup, type CountupDraft, normalizeCountupDraft } from '../src/core/countup';
import type { AppRepository } from '../src/state/AppProvider';

export const fixture = (id: string, values: Partial<Birthday> = {}): Birthday => ({
  id,
  name: `亲友${id}`,
  lunar: { month: 7, day: 23, isLeap: false },
  solar: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...values,
});
export const countupFixture = (id: string, values: Partial<Countup> = {}): Countup => ({
  id,
  type: 'countup',
  title: `累计事项${id}`,
  startDate: '2026-09-04',
  note: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...values,
});
// State/interaction tests inject memory; actual persistence is tested separately.
export function memoryRepository(initial: Birthday[] = [], initialCountups: Countup[] = []) {
  let rows = [...initial],
    countups = [...initialCountups],
    sequence = 0;
  return {
    initialize: jest.fn(async () => {}),
    list: jest.fn(async () => [...rows]),
    create: jest.fn(async (input: BirthdayDraft) => {
      const row = fixture(`new-${++sequence}`, normalizeDraft(input));
      rows.push(row);
      return row;
    }),
    update: jest.fn(async (id: string, input: BirthdayDraft) => {
      const old = rows.find((r) => r.id === id);
      if (!old) throw new Error('不存在');
      const row = { ...old, ...normalizeDraft(input) };
      rows = rows.map((p) => (p.id === id ? row : p));
      return row;
    }),
    remove: jest.fn(async (id: string) => {
      rows = rows.filter((r) => r.id !== id);
    }),
    listCountups: jest.fn(async () => [...countups]),
    createCountup: jest.fn(async (input: CountupDraft) => {
      const row = countupFixture(`countup-${++sequence}`, normalizeCountupDraft(input));
      countups.push(row);
      return row;
    }),
    updateCountup: jest.fn(async (id: string, input: CountupDraft) => {
      const old = countups.find((item) => item.id === id);
      if (!old) throw new Error('不存在');
      const row = { ...old, ...normalizeCountupDraft(input) };
      countups = countups.map((item) => (item.id === id ? row : item));
      return row;
    }),
    removeCountup: jest.fn(async (id: string) => {
      countups = countups.filter((item) => item.id !== id);
    }),
    close: jest.fn(async () => {}),
  } satisfies AppRepository;
}
