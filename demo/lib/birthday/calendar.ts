/** Bounded month fixtures for the UI demo, not a production calendar service.
 * Fixtures: lunar-python 1.4.4 month starts; dates never depend on the machine timezone.
 */
export const MONTH_NAMES = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '腊月',
];
export const DAY_NAMES = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
];
type Month = { month: number; days: number; start: string };
const raw: Record<number, [number, number, string][]> = {
  2025: [
    [1, 30, '2025-01-29'],
    [2, 29, '2025-02-28'],
    [3, 30, '2025-03-29'],
    [4, 29, '2025-04-28'],
    [5, 29, '2025-05-27'],
    [6, 30, '2025-06-25'],
    [-6, 29, '2025-07-25'],
    [7, 30, '2025-08-23'],
    [8, 29, '2025-09-22'],
    [9, 30, '2025-10-21'],
    [10, 30, '2025-11-20'],
    [11, 30, '2025-12-20'],
    [12, 29, '2026-01-19'],
  ],
  2026: [
    [1, 30, '2026-02-17'],
    [2, 29, '2026-03-19'],
    [3, 30, '2026-04-17'],
    [4, 29, '2026-05-17'],
    [5, 29, '2026-06-15'],
    [6, 30, '2026-07-14'],
    [7, 29, '2026-08-13'],
    [8, 29, '2026-09-11'],
    [9, 30, '2026-10-10'],
    [10, 30, '2026-11-09'],
    [11, 30, '2026-12-09'],
    [12, 29, '2027-01-08'],
  ],
  2027: [
    [1, 30, '2027-02-06'],
    [2, 30, '2027-03-08'],
    [3, 29, '2027-04-07'],
    [4, 30, '2027-05-06'],
    [5, 29, '2027-06-05'],
    [6, 29, '2027-07-04'],
    [7, 30, '2027-08-02'],
    [8, 29, '2027-09-01'],
    [9, 29, '2027-09-30'],
    [10, 30, '2027-10-29'],
    [11, 30, '2027-11-28'],
    [12, 29, '2027-12-28'],
  ],
  2028: [
    [1, 30, '2028-01-26'],
    [2, 30, '2028-02-25'],
    [3, 30, '2028-03-26'],
    [4, 29, '2028-04-25'],
    [5, 30, '2028-05-24'],
    [-5, 29, '2028-06-23'],
    [6, 29, '2028-07-22'],
    [7, 30, '2028-08-20'],
    [8, 29, '2028-09-19'],
    [9, 29, '2028-10-18'],
    [10, 30, '2028-11-16'],
    [11, 30, '2028-12-16'],
    [12, 29, '2029-01-15'],
  ],
};
export const CALENDAR: Record<number, Month[]> = Object.fromEntries(
  Object.entries(raw).map(([year, months]) => [
    year,
    months.map(([month, days, start]) => ({ month, days, start })),
  ]),
);
export type LunarBirthday = { month: number; day: number; isLeap: boolean };
export type Occurrence = {
  lunarYear: number;
  solar: string;
  actualMonth: number;
  actualDay: number;
  notes: string[];
};
const DAY_MS = 86_400_000;
export function dayNumber(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
    throw new Error('日期格式应为 YYYY-MM-DD');
  const milliseconds = Date.parse(`${iso}T00:00:00Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== iso
  )
    throw new Error('日期无效');
  return milliseconds / DAY_MS;
}
export function addDays(iso: string, days: number) {
  return new Date((dayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);
}
export function daysUntil(iso: string, today: string) {
  return dayNumber(iso) - dayNumber(today);
}
export function lunarLabel(birthday: LunarBirthday) {
  return `${birthday.isLeap ? '闰' : ''}${MONTH_NAMES[birthday.month - 1]}${DAY_NAMES[birthday.day - 1]}`;
}
export function occurrenceForYear(
  birthday: LunarBirthday,
  year: number,
): Occurrence {
  if (
    !Number.isInteger(birthday.month) ||
    birthday.month < 1 ||
    birthday.month > 12 ||
    !Number.isInteger(birthday.day) ||
    birthday.day < 1 ||
    birthday.day > 30 ||
    typeof birthday.isLeap !== 'boolean'
  )
    throw new Error('农历日期无效');
  const months = CALENDAR[year];
  if (!months) throw new Error('演示历表仅覆盖 2025—2028 农历年');
  const leap = months.find((m) => m.month === -birthday.month);
  const selected =
    (birthday.isLeap && leap) ||
    months.find((m) => m.month === birthday.month)!;
  const actualDay = Math.min(birthday.day, selected.days);
  const notes: string[] = [];
  if (birthday.isLeap && !leap)
    notes.push(
      `本年无闰${MONTH_NAMES[birthday.month - 1]}，按普通${MONTH_NAMES[birthday.month - 1]}过`,
    );
  if (actualDay !== birthday.day)
    notes.push('本月只有二十九天，提前到二十九提醒');
  return {
    lunarYear: year,
    solar: addDays(selected.start, actualDay - 1),
    actualMonth: selected.month,
    actualDay,
    notes,
  };
}
export function upcomingOccurrences(
  birthday: LunarBirthday,
  today: string,
): Occurrence[] {
  dayNumber(today);
  return Object.keys(CALENDAR)
    .map(Number)
    .map((year) => occurrenceForYear(birthday, year))
    .filter((item) => item.solar >= today)
    .sort((a, b) => a.solar.localeCompare(b.solar));
}
export function lunarOnDate(iso: string) {
  const index = dayNumber(iso);
  for (const [year, months] of Object.entries(CALENDAR))
    for (const month of months) {
      const offset = index - dayNumber(month.start);
      if (offset >= 0 && offset < month.days)
        return {
          year: Number(year),
          month: Math.abs(month.month),
          day: offset + 1,
          isLeap: month.month < 0,
        };
    }
  throw new Error('日期超出演示历表范围');
}
