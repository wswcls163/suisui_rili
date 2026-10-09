import { entriesForMonth } from '../src/core/birthday';
import { lunarCalendar } from '../src/core/calendar';
import { selectedTimelineItems, upcomingTimelineItems } from '../src/components/home/homeEvents';
import { countupFixture, fixture } from './helpers';

test('首页事项流只使用真实生日、节日和时光记数据', () => {
  const date = '2026-09-10';
  const person = fixture('teacher', {
    name: '老师',
    lunar: null,
    solar: { month: 9, day: 10 },
  });
  const memory = countupFixture('work', {
    title: '入职纪念',
    startDate: '2025-09-10',
    displayMode: 'anniversary',
  });
  const items = selectedTimelineItems(date, entriesForMonth(lunarCalendar, [person], date), [memory]);

  expect(items.map((item) => [item.kind, item.title])).toEqual([
    ['festival', '教师节'],
    ['birthday', '老师的生日'],
    ['memory', '入职纪念'],
  ]);
  expect(items.find((item) => item.kind === 'birthday')?.personId).toBe('teacher');
  expect(items.find((item) => item.kind === 'memory')?.countupId).toBe('work');
});

test('未来事项限制在 30 天并正确处理周年和普通记录的开始日', () => {
  const from = '2026-09-04';
  const annual = countupFixture('annual', {
    title: '每年纪念',
    startDate: '2024-09-18',
    displayMode: 'anniversary',
  });
  const future = countupFixture('future', {
    title: '即将开始',
    startDate: '2026-09-20',
    displayMode: 'days',
  });
  const active = countupFixture('active', {
    title: '已经开始',
    startDate: '2026-09-01',
    displayMode: 'days',
  });
  const items = upcomingTimelineItems(from, [], [annual, future, active]);

  expect(items.some((item) => item.title === '每年纪念' && item.date === '2026-09-18')).toBe(true);
  expect(items.some((item) => item.title === '即将开始' && item.date === '2026-09-20')).toBe(true);
  expect(items.some((item) => item.title === '已经开始')).toBe(false);
  expect(items.every((item) => item.date > from && item.date <= '2026-10-04')).toBe(true);
});
