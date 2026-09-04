import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALENDAR,
  addDays,
  daysUntil,
  lunarLabel,
  lunarOnDate,
  occurrenceForYear,
  upcomingOccurrences,
  dayNumber,
} from '../lib/birthday/calendar.ts';

void test('九月初九每年换算，而不是固定阳历日期', () => {
  const birthday = { month: 9, day: 9, isLeap: false };
  assert.equal(occurrenceForYear(birthday, 2025).solar, '2025-10-29');
  assert.equal(occurrenceForYear(birthday, 2026).solar, '2026-10-18');
});
void test('有对应闰月时，只在闰月过', () => {
  const occurrence = occurrenceForYear(
    { month: 6, day: 2, isLeap: true },
    2025,
  );
  assert.equal(occurrence.solar, '2025-07-26');
  assert.equal(occurrence.actualMonth, -6);
  assert.deepEqual(occurrence.notes, []);
});
void test('没有对应闰月时回退普通月，保留原始生日', () => {
  const birthday = Object.freeze({ month: 9, day: 9, isLeap: true });
  const occurrence = occurrenceForYear(birthday, 2026);
  assert.equal(occurrence.solar, '2026-10-18');
  assert.equal(occurrence.actualMonth, 9);
  assert.equal(occurrence.notes.length, 1);
  assert.equal(birthday.isLeap, true);
});
void test('三十在小月提前，下一年大月仍保留三十', () => {
  const birthday = { month: 2, day: 30, isLeap: false };
  assert.equal(occurrenceForYear(birthday, 2026).solar, '2026-04-16');
  assert.equal(occurrenceForYear(birthday, 2026).actualDay, 29);
  assert.equal(occurrenceForYear(birthday, 2027).solar, '2027-04-06');
  assert.equal(occurrenceForYear(birthday, 2027).actualDay, 30);
});
void test('闰月回退和月末提前可以组合', () => {
  const occurrence = occurrenceForYear(
    { month: 2, day: 30, isLeap: true },
    2026,
  );
  assert.equal(occurrence.solar, '2026-04-16');
  assert.equal(occurrence.notes.length, 2);
});
void test('真实闰月也可能只有二十九天', () => {
  const occurrence = occurrenceForYear(
    { month: 6, day: 30, isLeap: true },
    2025,
  );
  assert.equal(occurrence.solar, '2025-08-22');
  assert.equal(occurrence.actualMonth, -6);
  assert.equal(occurrence.actualDay, 29);
});
void test('普通六月生日不在闰六月重复', () => {
  const upcoming = upcomingOccurrences(
    { month: 6, day: 2, isLeap: false },
    '2025-07-01',
  );
  assert.equal(upcoming[0].solar, '2026-07-15');
});
void test('阳历年初包含上一农历年的腊月生日', () => {
  const occurrence = upcomingOccurrences(
    { month: 12, day: 30, isLeap: false },
    '2026-01-01',
  )[0];
  assert.equal(occurrence.lunarYear, 2025);
  assert.equal(occurrence.solar, '2026-02-16');
});
void test('当天包含在内，跨午夜后指向下一年', () => {
  const birthday = { month: 9, day: 9, isLeap: false };
  assert.equal(
    upcomingOccurrences(birthday, '2026-10-18')[0].solar,
    '2026-10-18',
  );
  assert.equal(
    upcomingOccurrences(birthday, '2026-10-19')[0].solar,
    '2027-10-08',
  );
  assert.equal(daysUntil('2026-10-18', '2026-10-18'), 0);
});
void test('无效的日期、农历输入和超出演示范围会失败', () => {
  assert.throws(() => dayNumber('2026-02-30'));
  assert.throws(() => dayNumber('not-a-date'));
  assert.throws(() =>
    occurrenceForYear({ month: 13, day: 1, isLeap: false }, 2026),
  );
  assert.throws(() =>
    occurrenceForYear({ month: 1, day: 0, isLeap: false }, 2026),
  );
  assert.throws(() =>
    occurrenceForYear({ month: 1, day: 1, isLeap: false }, 2030),
  );
  assert.throws(() => lunarOnDate('2024-01-01'));
});
void test('历表月份连续，每个月的日期均能往返且不越过月末', () => {
  const months = Object.entries(CALENDAR).flatMap(([year, rows]) =>
    rows.map((m) => ({ ...m, year: Number(year) })),
  );
  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    if (i < months.length - 1)
      assert.equal(addDays(month.start, month.days), months[i + 1].start);
    for (let day = 1; day <= 30; day++) {
      const birthday = {
        month: Math.abs(month.month),
        day,
        isLeap: month.month < 0,
      };
      const occurrence = occurrenceForYear(birthday, month.year);
      const actual = lunarOnDate(occurrence.solar);
      assert.equal(actual.month, birthday.month);
      assert.equal(actual.isLeap, birthday.isLeap);
      assert.equal(actual.day, Math.min(day, month.days));
    }
  }
});
void test('农历名称包含正确闰月标记', () => {
  assert.equal(lunarLabel({ month: 9, day: 9, isLeap: true }), '闰九月初九');
  assert.equal(lunarLabel({ month: 12, day: 30, isLeap: false }), '腊月三十');
});
