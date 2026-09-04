import { Solar, LunarYear } from 'lunar-javascript';
import { dayNumber, requireSupported } from './dates';

export type LunarDate = { year: number; month: number; day: number; isLeap: boolean };
export type LunarMonth = { year: number; month: number; isLeap: boolean; days: number; start: string };
export interface LunarCalendar {
  lunarOn(date: string): LunarDate;
  month(year: number, month: number, isLeap: boolean): LunarMonth | null;
}
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
export function lunarLabel(date: { month: number; day: number; isLeap: boolean }): string {
  return `${date.isLeap ? '闰' : ''}${MONTH_NAMES[date.month - 1]}${DAY_NAMES[date.day - 1]}`;
}

const months = new Map<string, LunarMonth | null>();
const solarTerms = new Map<number, Map<string, string>>();
const solarTermNames = [
  '小寒',
  '大寒',
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
  '冬至',
];
// Use the same published HKO convention as the lunar-date adapter.
// The six day-boundary differences are documented in tests/fixtures/README.md.
const hkoSolarTerms: Record<string, string> = {
  '1912-小雪': '1912-11-23',
  '1913-秋分': '1913-09-24',
  '1917-大雪': '1917-12-07',
  '1927-白露': '1927-09-08',
  '1928-夏至': '1928-06-21',
  '1979-大寒': '1979-01-21',
};

export function solarTermOn(date: string): string | null {
  requireSupported(date);
  const year = Number(date.slice(0, 4));
  if (!solarTerms.has(year)) {
    const table = Solar.fromYmd(year, 4, 1).getLunar().getJieQiTable();
    solarTerms.set(
      year,
      new Map(
        solarTermNames.map((name) => [
          // The library's Chinese 冬至 key refers to the previous December.
          hkoSolarTerms[`${year}-${name}`] ?? table[name === '冬至' ? 'DONG_ZHI' : name].toYmd(),
          name,
        ]),
      ),
    );
  }
  return solarTerms.get(year)!.get(date) ?? null;
}

// HKO's published 2057 table places the ninth-month new moon one day earlier
// than lunar-javascript 1.7.7. Both conversion directions use the same convention.
// Source: https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2057e.txt
const hko2057: LunarMonth[] = [
  { year: 2057, month: 8, isLeap: false, start: '2057-08-30', days: 29 },
  { year: 2057, month: 9, isLeap: false, start: '2057-09-28', days: 30 },
];
export const lunarCalendar: LunarCalendar = {
  lunarOn(date) {
    requireSupported(date);
    for (const correction of hko2057) {
      const offset = dayNumber(date) - dayNumber(correction.start);
      if (offset >= 0 && offset < correction.days)
        return { year: 2057, month: correction.month, day: offset + 1, isLeap: false };
    }
    const [year, month, day] = date.split('-').map(Number);
    const lunar = Solar.fromYmd(year, month, day).getLunar();
    return {
      year: lunar.getYear(),
      month: Math.abs(lunar.getMonth()),
      day: lunar.getDay(),
      isLeap: lunar.getMonth() < 0,
    };
  },
  month(year, month, isLeap) {
    const correction = hko2057.find((m) => m.year === year && m.month === month && m.isLeap === isLeap);
    if (correction) return correction;
    const key = `${year}-${month}-${isLeap}`;
    if (months.has(key)) return months.get(key)!;
    const found = LunarYear.fromYear(year).getMonth(isLeap ? -month : month);
    const value = found
      ? {
          year,
          month,
          isLeap,
          days: found.getDayCount(),
          start: Solar.fromJulianDay(found.getFirstJulianDay()).toYmd(),
        }
      : null;
    months.set(key, value);
    return value;
  },
};
