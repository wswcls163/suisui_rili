import { festivalsOn } from '../src/core/festivals';
import { qingmingDate } from '../src/core/calendar';
import { addDays, LAST_DATE } from '../src/core/dates';
import hko from './fixtures/hko-months.json';

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
  expect(qingmingDate(2024)).toBe('2024-04-04');
  expect(festivalsOn('2024-04-04')).toContain('清明');
  expect(festivalsOn('2024-04-05')).not.toContain('清明');
  expect(festivalsOn('2026-04-04')).not.toContain('清明');
  expect(festivalsOn('2026-04-05')).toContain('清明');
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
