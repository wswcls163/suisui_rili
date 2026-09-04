import {
  type Birthday,
  type BirthdayDraft,
  type BirthdayRepository,
  normalizeDraft,
} from '../src/core/birthday';

export const fixture = (id: string, values: Partial<Birthday> = {}): Birthday => ({
  id,
  name: `亲友${id}`,
  lunar: { month: 7, day: 23, isLeap: false },
  solar: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...values,
});
// State/interaction tests inject memory; actual persistence is tested separately.
export function memoryRepository(initial: Birthday[] = []) {
  let rows = [...initial],
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
    close: jest.fn(async () => {}),
  } satisfies BirthdayRepository;
}
