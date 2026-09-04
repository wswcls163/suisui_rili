import { festivalsOn, shortFestivalName } from '../src/core/festivals';
import { solarTermOn } from '../src/core/calendar';
import { addDays, LAST_DATE } from '../src/core/dates';
import hko from './fixtures/hko-months.json';

test.each([
  ['北方小年', '北小年'],
  ['南方小年', '南小年'],
  ['日本投降日', '日本投降'],
  ['抗战胜利纪念日', '抗战胜利'],
  ['九一八事变纪念日', '九一八'],
  ['大寒', '大寒'],
])('网格简称 %s 保持清楚：%s', (name, shortName) => {
  expect(shortFestivalName(name)).toBe(shortName);
});

test.each([
  ['2026-01-01', '元旦'],
  ['2026-02-16', '除夕'],
  ['2026-02-17', '春节'],
  ['2026-03-03', '元宵'],
  ['2026-04-05', '清明'],
  ['2026-05-01', '劳动节'],
  ['2026-06-01', '儿童节'],
  ['2026-06-19', '端午'],
  ['2026-08-19', '七夕'],
  ['2026-09-10', '教师节'],
  ['2026-09-25', '中秋'],
  ['2026-10-01', '国庆'],
  ['2026-10-18', '重阳'],
  ['2026-02-10', '北方小年'],
  ['2026-02-11', '南方小年'],
  ['2026-08-15', '日本投降日'],
  ['2026-09-03', '抗战胜利纪念日'],
  ['2026-09-18', '九一八事变纪念日'],
])('%s 标注常见节日 %s', (date, name) => {
  expect(festivalsOn(date)).toContain(name);
});

test('农历节日逐年变化，不把某年的阳历日期重复到下一年', () => {
  expect(festivalsOn('2025-10-06')).toContain('中秋');
  expect(festivalsOn('2026-10-06')).not.toContain('中秋');
  expect(festivalsOn('2027-09-15')).toContain('中秋');
});

test('除夕兼容腊月三十和廿九，农历新年前一天只标一次', () => {
  expect(festivalsOn('2024-02-09')).toContain('除夕');
  expect(festivalsOn('2024-02-08')).not.toContain('除夕');
  expect(festivalsOn('2025-01-28')).toContain('除夕');
  expect(festivalsOn('2025-01-29')).toContain('春节');
  expect(festivalsOn('2025-01-29')).not.toContain('除夕');
});

test('清明按节气日期，4 月 4 日和 5 日不会固定重复', () => {
  expect(solarTermOn('2024-04-04')).toBe('清明');
  expect(festivalsOn('2024-04-04')).toContain('清明');
  expect(festivalsOn('2024-04-05')).not.toContain('清明');
  expect(festivalsOn('2026-04-04')).not.toContain('清明');
  expect(festivalsOn('2026-04-05')).toContain('清明');
});

test.each([
  ['2026-01-05', '小寒'],
  ['2026-01-20', '大寒'],
  ['2026-02-04', '立春'],
  ['2026-02-18', '雨水'],
  ['2026-03-05', '惊蛰'],
  ['2026-03-20', '春分'],
  ['2026-04-05', '清明'],
  ['2026-04-20', '谷雨'],
  ['2026-05-05', '立夏'],
  ['2026-05-21', '小满'],
  ['2026-06-05', '芒种'],
  ['2026-06-21', '夏至'],
  ['2026-07-07', '小暑'],
  ['2026-07-23', '大暑'],
  ['2026-08-07', '立秋'],
  ['2026-08-23', '处暑'],
  ['2026-09-07', '白露'],
  ['2026-09-23', '秋分'],
  ['2026-10-08', '寒露'],
  ['2026-10-23', '霜降'],
  ['2026-11-07', '立冬'],
  ['2026-11-22', '小雪'],
  ['2026-12-07', '大雪'],
  ['2026-12-22', '冬至'],
])('二十四节气：%s 显示 %s，前后一天不重复', (date, name) => {
  expect(solarTermOn(date)).toBe(name);
  expect(festivalsOn(date)).toContain(name);
  expect(solarTermOn(addDays(date, -1))).not.toBe(name);
  expect(solarTermOn(addDays(date, 1))).not.toBe(name);
});

test('冬至使用当前阳历年；跨年节气重新计算', () => {
  expect(solarTermOn('2025-12-21')).toBe('冬至');
  expect(solarTermOn('2026-12-21')).toBeNull();
  expect(solarTermOn('2026-12-22')).toBe('冬至');
  expect(solarTermOn('2026-01-05')).toBe('小寒');
  expect(solarTermOn('1901-01-01')).toBeNull();
  expect(() => solarTermOn('1900-12-31')).toThrow();
});

test('南北小年逐年按腊月日期换算，同日大寒也保留；清明只显示一次', () => {
  expect(festivalsOn('2025-01-22')).toContain('北方小年');
  expect(festivalsOn('2025-01-23')).toContain('南方小年');
  expect(festivalsOn('2026-01-22')).not.toContain('北方小年');
  expect(festivalsOn('2017-01-20')).toEqual(['北方小年', '大寒']);
  expect(festivalsOn('2026-04-05').filter((name) => name === '清明')).toHaveLength(1);
});

test.each([
  ['08-15', 1945, '日本投降日'],
  ['09-03', 1945, '抗战胜利纪念日'],
  ['09-18', 1931, '九一八事变纪念日'],
])('纪念日 %s 不标注到事件发生之前', (monthDay, firstYear, name) => {
  expect(festivalsOn(`${firstYear}-${monthDay}`)).toContain(name);
  expect(festivalsOn(`${Number(firstYear) - 1}-${monthDay}`)).not.toContain(name);
  expect(festivalsOn(`2100-${monthDay}`)).toContain(name);
});

test.each([
  ['1912-11-23', '1912-11-22', '小雪'],
  ['1913-09-24', '1913-09-23', '秋分'],
  ['1917-12-07', '1917-12-08', '大雪'],
  ['1927-09-08', '1927-09-09', '白露'],
  ['1928-06-21', '1928-06-22', '夏至'],
  ['1979-01-21', '1979-01-20', '大寒'],
])('节气日界差异按天文台表：%s %s %s', (expected, libraryDate, name) => {
  expect(solarTermOn(expected)).toBe(name);
  expect(solarTermOn(libraryDate)).not.toBe(name);
});

test('中秋与国庆同日，完整保留两种节日', () => {
  expect(festivalsOn('2020-10-01')).toEqual(['中秋', '国庆']);
});

test('闰月不重复标注传统节日，覆盖独立历表中所有对应闰月', () => {
  const holidays = new Map([
    [1, { day: 1, name: '春节' }],
    [5, { day: 5, name: '端午' }],
    [7, { day: 7, name: '七夕' }],
    [8, { day: 15, name: '中秋' }],
    [9, { day: 9, name: '重阳' }],
  ]);
  let checked = 0;
  for (const [start, , signedMonth] of hko.months) {
    const month = Number(signedMonth);
    if (month >= 0) continue;
    const holiday = holidays.get(-month);
    if (!holiday) continue;
    const date = addDays(String(start), holiday.day - 1);
    if (date > LAST_DATE) continue;
    expect(festivalsOn(date)).not.toContain(holiday.name);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});

test('普通日期和未收录节日不标注，日期范围和严格校验保持一致', () => {
  expect(festivalsOn('2026-09-04')).toEqual([]);
  expect(festivalsOn('2026-04-01')).toEqual([]);
  expect(festivalsOn('1901-01-01')).toContain('元旦');
  expect(() => festivalsOn('2100-12-31')).not.toThrow();
  expect(() => festivalsOn('2101-01-01')).toThrow();
  expect(() => festivalsOn('2026-02-30')).toThrow();
});
