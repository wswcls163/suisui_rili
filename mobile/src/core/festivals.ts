import { lunarCalendar, solarTermOn } from './calendar';
import { addDays } from './dates';

// A curated list of familiar festivals, independent of birthdays and holiday leave schedules.
const solarFestivals: Record<string, string> = {
  '01-01': '元旦',
  '05-01': '劳动节',
  '06-01': '儿童节',
  '09-10': '教师节',
  '10-01': '国庆节',
};
const lunarFestivals: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵',
  '5-5': '端午',
  '7-7': '七夕',
  '8-15': '中秋节',
  '9-9': '重阳',
  '12-23': '北方小年',
  '12-24': '南方小年',
};

const memorials: Record<string, { name: string; fromYear: number }> = {
  '08-15': { name: '日本投降日', fromYear: 1945 },
  '09-03': { name: '抗战胜利纪念日', fromYear: 1945 },
  '09-18': { name: '九一八事变', fromYear: 1931 },
};

export function festivalsOn(date: string): string[] {
  const lunar = lunarCalendar.lunarOn(date);
  const names: string[] = [];
  const traditional = !lunar.isLeap && lunarFestivals[`${lunar.month}-${lunar.day}`];
  if (traditional) names.push(traditional);
  // The day before the next lunar New Year can be 腊月廿九 or 腊月三十.
  if (lunar.month === 12) {
    const newYear = lunarCalendar.month(lunar.year + 1, 1, false)!;
    if (date === addDays(newYear.start, -1)) names.push('除夕');
  }
  const solar = solarFestivals[date.slice(5)];
  if (solar) names.push(solar);
  const memorial = memorials[date.slice(5)];
  if (memorial && Number(date.slice(0, 4)) >= memorial.fromYear) names.push(memorial.name);
  const term = solarTermOn(date);
  if (term) names.push(term);
  return names;
}
