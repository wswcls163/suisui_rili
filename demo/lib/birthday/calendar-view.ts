import {
  CALENDAR,
  addDays,
  dayNumber,
  lunarOnDate,
  occurrenceForYear,
  MONTH_NAMES,
  DAY_NAMES,
} from './calendar.ts';
import type { Occurrence } from './calendar.ts';
import type { Draft, Person } from './demo-state.ts';

/** Creation types are a catalog, while birthday fields and occurrences remain in
 * their own adapter. Later types can supply forms and events without changing the grid.
 */
export const EVENT_TYPES = [
  { id: 'birthday', label: '生日', available: true },
  { id: 'schedule', label: '普通日程', available: false },
  { id: 'anniversary', label: '纪念日', available: false },
  { id: 'countdown', label: '倒数日', available: false },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]['id'];
export type BirthdayEntry = {
  type: 'birthday';
  id: string;
  date: string;
  title: string;
  person: Person;
  occurrence: Occurrence;
};

const months = Object.values(CALENDAR).flat();
export const FIRST_DEMO_DATE = months[0].start;
export const LAST_DEMO_DATE = addDays(
  months.at(-1)!.start,
  months.at(-1)!.days - 1,
);
export function isSupportedDate(iso: string) {
  try {
    dayNumber(iso);
    return iso >= FIRST_DEMO_DATE && iso <= LAST_DEMO_DATE;
  } catch {
    return false;
  }
}
export function monthStart(iso: string) {
  dayNumber(iso);
  return `${iso.slice(0, 7)}-01`;
}
export function shiftMonth(iso: string, delta: number) {
  dayNumber(iso);
  const [year, month] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1))
    .toISOString()
    .slice(0, 10);
}
export function isSupportedMonth(iso: string) {
  try {
    const month = monthStart(iso);
    return (
      month >= monthStart(FIRST_DEMO_DATE) &&
      month <= monthStart(LAST_DEMO_DATE)
    );
  } catch {
    return false;
  }
}
/** DatePicker uses local calendar fields. Never use toISOString() on its Date. */
export function pickerDate(iso: string) {
  dayNumber(iso);
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function pickerIso(date: Date) {
  if (!Number.isFinite(date.getTime())) throw new Error('日期无效');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateInMonth(selected: string, month: string) {
  dayNumber(selected);
  if (!isSupportedMonth(month)) throw new Error('月份超出演示历表范围');
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const iso = `${month.slice(0, 7)}-${String(Math.min(Number(selected.slice(8)), lastDay)).padStart(2, '0')}`;
  return iso < FIRST_DEMO_DATE
    ? FIRST_DEMO_DATE
    : iso > LAST_DEMO_DATE
      ? LAST_DEMO_DATE
      : iso;
}
export function lunarCellLabel(iso: string) {
  if (!isSupportedDate(iso)) return '范围外';
  const lunar = lunarOnDate(iso);
  return lunar.day === 1
    ? `${lunar.isLeap ? '闰' : ''}${MONTH_NAMES[lunar.month - 1]}`
    : DAY_NAMES[lunar.day - 1];
}
export function draftFromDate(iso: string): Draft {
  const lunar = lunarOnDate(iso);
  return { name: '', month: lunar.month, day: lunar.day, isLeap: lunar.isLeap };
}
export function validateCreationType(type: string): asserts type is 'birthday' {
  if (!EVENT_TYPES.some((item) => item.id === type && item.available))
    throw new Error('该类型尚未开放，第一期仅支持生日');
}
export function birthdayEntries(
  people: Person[],
  from: string,
  to: string,
): BirthdayEntry[] {
  dayNumber(from);
  dayNumber(to);
  if (from > to) throw new Error('日期范围无效');
  return people
    .flatMap((person) =>
      Object.keys(CALENDAR)
        .map(Number)
        .flatMap((year) => {
          const occurrence = occurrenceForYear(person, year);
          return occurrence.solar >= from && occurrence.solar <= to
            ? [
                {
                  type: 'birthday' as const,
                  id: `${person.id}-${year}`,
                  date: occurrence.solar,
                  title: `${person.name}的生日`,
                  person,
                  occurrence,
                },
              ]
            : [];
        }),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function entriesForMonth(people: Person[], month: string) {
  const start = monthStart(month);
  const [year, number] = start.split('-').map(Number);
  const end = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  return birthdayEntries(people, start, end);
}
