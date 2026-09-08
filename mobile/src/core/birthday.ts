import { addDays, dayNumber, FIRST_DATE, LAST_DATE, monthEnd, monthStart, requireSupported } from './dates';
import type { LunarCalendar } from './calendar';
import { MONTH_NAMES, lunarLabel } from './calendar';

export type SolarBirthday = { month: number; day: number };
export type LunarBirthday = SolarBirthday & { isLeap: boolean };
export type BirthdayDraft = { name: string; lunar: LunarBirthday | null; solar: SolarBirthday | null };
export type Birthday = BirthdayDraft & { id: string; createdAt: string; updatedAt: string };
export type BirthdayKind = 'lunar' | 'solar';
export function birthdayTitle(name: string): string {
  return name.endsWith('生日') ? name : `${name}的生日`;
}
export function solarBirthdayDays(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}
function normalizeDate(value: unknown, kind: BirthdayKind): LunarBirthday | SolarBirthday {
  const label = kind === 'lunar' ? '农历' : '阳历';
  if (!value || typeof value !== 'object') throw new Error(`请填写${label}生日`);
  const input = value as Record<string, unknown>;
  if (!Number.isInteger(input.month) || Number(input.month) < 1 || Number(input.month) > 12)
    throw new Error(`请选择有效的${label}月份`);
  const month = Number(input.month);
  if (
    !Number.isInteger(input.day) ||
    Number(input.day) < 1 ||
    Number(input.day) > (kind === 'lunar' ? 30 : solarBirthdayDays(month))
  )
    throw new Error(`请选择有效的${label}日期`);
  const day = Number(input.day);
  if (kind === 'solar') return { month, day };
  if (typeof input.isLeap !== 'boolean') throw new Error('请确认是否为闰月生日');
  return { month, day, isLeap: input.isLeap };
}
export function normalizeDraft(value: unknown): BirthdayDraft {
  if (!value || typeof value !== 'object') throw new Error('请填写生日信息');
  const input = value as Record<string, unknown>;
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('请填写姓名或称呼');
  const name = input.name.trim();
  if (Array.from(name).length > 30) throw new Error('称呼不能超过 30 个字符');
  const lunar = input.lunar === null ? null : (normalizeDate(input.lunar, 'lunar') as LunarBirthday);
  const solar = input.solar === null ? null : normalizeDate(input.solar, 'solar');
  if (!lunar && !solar) throw new Error('请至少选择一种生日');
  return { name, lunar, solar };
}
export const EVENT_TYPES = [
  { id: 'birthday', label: '生日', available: true },
  { id: 'schedule', label: '普通日程', available: false },
  { id: 'countup', label: '时光记', available: true },
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
export type Adjustment = 'leap-fallback' | 'short-month' | 'solar-leap-day';
export type Occurrence = {
  solar: string;
  kinds: BirthdayKind[];
  lunar: (LunarBirthday & { year: number }) | null;
  adjustments: Adjustment[];
};
export type BirthdayRow = { person: Birthday; next: Occurrence | null; remaining: number | null };
export type BirthdayEntry = { id: string; person: Birthday; occurrence: Occurrence };

export function occurrenceForYear(
  calendar: LunarCalendar,
  birthday: LunarBirthday,
  year: number,
): Occurrence {
  normalizeDate(birthday, 'lunar');
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('农历年份超出支持范围');
  const desired = calendar.month(year, birthday.month, birthday.isLeap);
  const actual = desired ?? calendar.month(year, birthday.month, false);
  if (!actual) throw new Error('无法读取农历月份');
  const day = Math.min(actual.days, birthday.day);
  const adjustments: Adjustment[] = [];
  if (birthday.isLeap && !actual.isLeap) adjustments.push('leap-fallback');
  if (day !== birthday.day) adjustments.push('short-month');
  return {
    solar: addDays(actual.start, day - 1),
    kinds: ['lunar'],
    lunar: { year, month: actual.month, day, isLeap: actual.isLeap },
    adjustments,
  };
}
export function solarOccurrenceForYear(birthday: SolarBirthday, year: number): Occurrence {
  normalizeDate(birthday, 'solar');
  if (!Number.isInteger(year) || year < 1901 || year > 2100) throw new Error('阳历年份超出支持范围');
  const month = `${year}-${String(birthday.month).padStart(2, '0')}-01`;
  const day = Math.min(birthday.day, Number(monthEnd(month).slice(8)));
  return {
    solar: `${month.slice(0, 8)}${String(day).padStart(2, '0')}`,
    kinds: ['solar'],
    lunar: null,
    adjustments: day === birthday.day ? [] : ['solar-leap-day'],
  };
}
function mergeOccurrences(values: Occurrence[]): Occurrence[] {
  const byDate = new Map<string, Occurrence>();
  for (const value of values) {
    const previous = byDate.get(value.solar);
    byDate.set(
      value.solar,
      previous
        ? {
            solar: value.solar,
            kinds: ['lunar', 'solar'],
            lunar: previous.lunar ?? value.lunar,
            adjustments: [...previous.adjustments, ...value.adjustments],
          }
        : value,
    );
  }
  return [...byDate.values()].sort((a, b) => a.solar.localeCompare(b.solar));
}
export function upcoming(
  calendar: LunarCalendar,
  birthday: BirthdayDraft,
  today: string,
  count = 1,
): Occurrence[] {
  normalizeDraft(birthday);
  dayNumber(today);
  if (today > LAST_DATE || count < 1) return [];
  const from = today < FIRST_DATE ? FIRST_DATE : today;
  const result: Occurrence[] = [];
  // Collect enough dates from each recurrence before merging and sorting.
  if (birthday.lunar) {
    let found = 0;
    for (let year = calendar.lunarOn(from).year; year <= 2100 && found < count; year++) {
      const occurrence = occurrenceForYear(calendar, birthday.lunar, year);
      if (occurrence.solar >= from && occurrence.solar <= LAST_DATE) {
        result.push(occurrence);
        found++;
      }
    }
  }
  if (birthday.solar) {
    let found = 0;
    for (let year = Number(from.slice(0, 4)); year <= 2100 && found < count; year++) {
      const occurrence = solarOccurrenceForYear(birthday.solar, year);
      if (occurrence.solar >= from) {
        result.push(occurrence);
        found++;
      }
    }
  }
  return mergeOccurrences(result).slice(0, count);
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
  const result: BirthdayEntry[] = [];
  for (const person of people) {
    // A month may contain both dates, including dates across a lunar year boundary.
    for (const occurrence of upcoming(calendar, person, from, 3)) {
      if (occurrence.solar <= to) result.push({ id: `${person.id}-${occurrence.solar}`, person, occurrence });
    }
  }
  return result.sort(
    (a, b) => a.occurrence.solar.localeCompare(b.occurrence.solar) || a.id.localeCompare(b.id),
  );
}
export function birthdayDates(birthday: BirthdayDraft, kinds: BirthdayKind[] = ['lunar', 'solar']): string {
  return [
    kinds.includes('lunar') && birthday.lunar ? `农历${lunarLabel(birthday.lunar)}` : '',
    kinds.includes('solar') && birthday.solar ? `阳历${birthday.solar.month}月${birthday.solar.day}日` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export function occurrenceLabel(item: Occurrence): string {
  return item.kinds.length === 2
    ? '农历与阳历生日 · 同一天'
    : item.kinds[0] === 'lunar'
      ? '农历生日'
      : '阳历生日';
}
export function adjustmentText(code: Adjustment, month: number): string {
  if (code === 'solar-leap-day') return '今年没有 2 月 29 日，提前到 2 月 28 日提醒';
  return code === 'leap-fallback'
    ? `本年无对应闰月，按普通${MONTH_NAMES[month - 1]}过`
    : '本月只有二十九天，提前到二十九提醒';
}
