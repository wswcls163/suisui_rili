import { addDays, dayNumber, FIRST_DATE, LAST_DATE, monthEnd, monthStart, requireSupported } from './dates';
import type { LunarCalendar } from './calendar';
import { MONTH_NAMES } from './calendar';

export type BirthdayDraft = { name: string; month: number; day: number; isLeap: boolean };
export type Birthday = BirthdayDraft & { id: string; createdAt: string; updatedAt: string };
export function birthdayTitle(name: string): string {
  return name.endsWith('生日') ? name : `${name}的生日`;
}

export function normalizeDraft(value: unknown): BirthdayDraft {
  if (!value || typeof value !== 'object') throw new Error('请填写生日信息');
  const input = value as Record<string, unknown>;
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('请填写姓名或称呼');
  const name = input.name.trim();
  if (Array.from(name).length > 30) throw new Error('称呼不能超过 30 个字符');
  if (!Number.isInteger(input.month) || Number(input.month) < 1 || Number(input.month) > 12)
    throw new Error('请选择有效的农历月份');
  if (!Number.isInteger(input.day) || Number(input.day) < 1 || Number(input.day) > 30)
    throw new Error('请选择有效的农历日期');
  if (typeof input.isLeap !== 'boolean') throw new Error('请确认是否为闰月生日');
  return { name, month: Number(input.month), day: Number(input.day), isLeap: input.isLeap };
}
export const EVENT_TYPES = [
  { id: 'birthday', label: '生日', available: true },
  { id: 'schedule', label: '普通日程', available: false },
  { id: 'anniversary', label: '纪念日', available: false },
  { id: 'countdown', label: '倒数日', available: false },
] as const;
export function requireBirthdayType(type: string): void {
  if (type !== 'birthday') throw new Error('该类型尚未开放，第一期仅支持生日');
}
export interface BirthdayRepository {
  initialize(): Promise<void>;
  list(): Promise<Birthday[]>;
  create(draft: BirthdayDraft): Promise<Birthday>;
  update(id: string, draft: BirthdayDraft): Promise<Birthday>;
  remove(id: string): Promise<void>;
  close(): Promise<void>;
}

export type Adjustment = 'leap-fallback' | 'short-month';
export type Occurrence = {
  lunarYear: number;
  solar: string;
  actualMonth: number;
  actualDay: number;
  actualLeap: boolean;
  adjustments: Adjustment[];
};
export type BirthdayRow = { person: Birthday; next: Occurrence | null; remaining: number | null };
export type BirthdayEntry = { id: string; person: Birthday; occurrence: Occurrence };

export function occurrenceForYear(
  calendar: LunarCalendar,
  birthday: BirthdayDraft,
  year: number,
): Occurrence {
  normalizeDraft(birthday);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('农历年份超出支持范围');
  const desired = calendar.month(year, birthday.month, birthday.isLeap);
  const actual = desired ?? calendar.month(year, birthday.month, false);
  if (!actual) throw new Error('无法读取农历月份');
  const day = Math.min(actual.days, birthday.day);
  const adjustments: Adjustment[] = [];
  if (birthday.isLeap && !actual.isLeap) adjustments.push('leap-fallback');
  if (day !== birthday.day) adjustments.push('short-month');
  return {
    lunarYear: year,
    solar: addDays(actual.start, day - 1),
    actualMonth: actual.month,
    actualDay: day,
    actualLeap: actual.isLeap,
    adjustments,
  };
}
export function upcoming(
  calendar: LunarCalendar,
  birthday: BirthdayDraft,
  today: string,
  count = 1,
): Occurrence[] {
  dayNumber(today);
  if (today > LAST_DATE || count < 1) return [];
  const from = today < FIRST_DATE ? FIRST_DATE : today;
  const result: Occurrence[] = [];
  for (let year = calendar.lunarOn(from).year; year <= 2100 && result.length < count; year++) {
    const occurrence = occurrenceForYear(calendar, birthday, year);
    if (occurrence.solar >= from && occurrence.solar <= LAST_DATE) result.push(occurrence);
  }
  return result;
}
export function birthdayRows(calendar: LunarCalendar, people: Birthday[], today: string): BirthdayRow[] {
  return people
    .map((person) => {
      const next = upcoming(calendar, person, today)[0] ?? null;
      return { person, next, remaining: next ? dayNumber(next.solar) - dayNumber(today) : null };
    })
    .sort(
      (a, b) =>
        (a.remaining ?? Infinity) - (b.remaining ?? Infinity) ||
        a.person.createdAt.localeCompare(b.person.createdAt) ||
        a.person.id.localeCompare(b.person.id),
    );
}
export function entriesForMonth(calendar: LunarCalendar, people: Birthday[], month: string): BirthdayEntry[] {
  const from = monthStart(month),
    to = monthEnd(month);
  requireSupported(from);
  requireSupported(to);
  const firstYear = calendar.lunarOn(from).year,
    lastYear = calendar.lunarOn(to).year;
  const result: BirthdayEntry[] = [];
  for (const person of people)
    for (let year = firstYear; year <= lastYear; year++) {
      const occurrence = occurrenceForYear(calendar, person, year);
      if (occurrence.solar >= from && occurrence.solar <= to)
        result.push({ id: `${person.id}-${year}`, person, occurrence });
    }
  return result.sort(
    (a, b) => a.occurrence.solar.localeCompare(b.occurrence.solar) || a.id.localeCompare(b.id),
  );
}
export function adjustmentText(code: Adjustment, month: number): string {
  return code === 'leap-fallback'
    ? `本年无对应闰月，按普通${MONTH_NAMES[month - 1]}过`
    : '本月只有二十九天，提前到二十九提醒';
}
