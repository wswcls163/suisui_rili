// Calendar dates stay independent of the device timezone and UI framework.
export const FIRST_DATE = '1901-01-01';
export const LAST_DATE = '2100-12-31';
export const DAY_MS = 86_400_000;
export const BEIJING_OFFSET = 8 * 60 * 60 * 1000;
export const CHINESE_WEEKDAYS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
] as const;

export function dayNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式应为 YYYY-MM-DD');
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date)
    throw new Error('日期无效');
  return time / DAY_MS;
}
export function addDays(date: string, count: number): string {
  return new Date((dayNumber(date) + count) * DAY_MS).toISOString().slice(0, 10);
}
export function supported(date: string): boolean {
  try {
    dayNumber(date);
    return date >= FIRST_DATE && date <= LAST_DATE;
  } catch {
    return false;
  }
}
export function requireSupported(date: string): void {
  if (!supported(date)) throw new Error('支持的阳历日期为 1901—2100 年');
}
export function clampDate(date: string): string {
  dayNumber(date);
  return date < FIRST_DATE ? FIRST_DATE : date > LAST_DATE ? LAST_DATE : date;
}
export function monthStart(date: string): string {
  dayNumber(date);
  return `${date.slice(0, 7)}-01`;
}
export function shiftMonth(date: string, delta: number): string {
  dayNumber(date);
  const [year, month] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 10);
}
export function monthEnd(date: string): string {
  return addDays(shiftMonth(date, 1), -1);
}
export function dateInMonth(date: string, month: string): string {
  return `${month.slice(0, 7)}-${String(Math.min(Number(date.slice(8)), Number(monthEnd(month).slice(8)))).padStart(2, '0')}`;
}
export function monthGrid(month: string): (string | null)[][] {
  requireSupported(month);
  const first = monthStart(month);
  const offset = new Date(`${first}T00:00:00Z`).getUTCDay();
  const count = Number(monthEnd(first).slice(8));
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + count ? addDays(first, i - offset) : null,
  );
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
export function todayInBeijing(now: number): string {
  return new Date(now + BEIJING_OFFSET).toISOString().slice(0, 10);
}
export function chineseWeekday(date: string): (typeof CHINESE_WEEKDAYS)[number] {
  return CHINESE_WEEKDAYS[new Date(dayNumber(date) * DAY_MS).getUTCDay()];
}
export function chineseFullDate(date: string): string {
  dayNumber(date);
  const [year, month, day] = date.split('-').map(Number);
  return `${year} 年 ${month} 月 ${day} 日 ${chineseWeekday(date)}`;
}
export function untilMidnight(now: number): number {
  return Math.max(1, (dayNumber(todayInBeijing(now)) + 1) * DAY_MS - BEIJING_OFFSET - now);
}
