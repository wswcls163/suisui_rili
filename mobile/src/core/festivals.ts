import { lunarCalendar, qingmingDate } from './calendar';
import { addDays } from './dates';

// A curated list of familiar festivals, independent of birthdays and holiday leave schedules.
const solarFestivals: Record<string, string> = {
  '01-01': '元旦',
  '05-01': '劳动节',
  '06-01': '儿童节',
  '09-10': '教师节',
  '10-01': '国庆',
};
const lunarFestivals: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵',
  '5-5': '端午',
  '7-7': '七夕',
  '8-15': '中秋',
  '9-9': '重阳',
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
  if (date.slice(5, 7) === '04' && date === qingmingDate(Number(date.slice(0, 4)))) names.push('清明');
  const solar = solarFestivals[date.slice(5)];
  if (solar) names.push(solar);
  return names;
}
