import { lunarCalendar } from '../src/core/calendar';
import {
  beijingTriggerAt,
  buildNotificationPlan,
  MAX_SCHEDULED_REMINDERS,
  normalizeNotificationSettings,
} from '../src/core/notification';
import { countupFixture, fixture } from './helpers';

const enabled = { enabled: true, hour: 9, minute: 0 };

describe('系统通知排程', () => {
  test('生日当天九点提醒，错过当天时间后自动安排下一年', () => {
    const person = fixture('solar', { lunar: null, solar: { month: 11, day: 11 }, name: '妈妈' });
    const morning = buildNotificationPlan({
      calendar: lunarCalendar,
      people: [person],
      countups: [],
      now: Date.parse('2026-11-11T08:30:00+08:00'),
      settings: enabled,
    });
    expect(morning.find((item) => item.itemId === 'solar')).toMatchObject({
      date: '2026-11-11',
      triggerAt: Date.parse('2026-11-11T09:00:00+08:00'),
      title: '今天是妈妈的生日',
    });

    const late = buildNotificationPlan({
      calendar: lunarCalendar,
      people: [person],
      countups: [],
      now: Date.parse('2026-11-11T09:01:00+08:00'),
      settings: enabled,
    });
    expect(late.find((item) => item.itemId === 'solar')?.date).toBe('2027-11-11');
  });

  test('同一个人的农历和阳历生日重合时只安排一条通知', () => {
    const lunar = lunarCalendar.lunarOn('2026-09-11');
    const person = fixture('both', {
      name: '自己',
      lunar,
      solar: { month: 9, day: 11 },
    });
    const plan = buildNotificationPlan({
      calendar: lunarCalendar,
      people: [person],
      countups: [],
      now: Date.parse('2026-09-10T12:00:00+08:00'),
      settings: enabled,
    });
    const current = plan.filter((item) => item.date === '2026-09-11');
    expect(current).toHaveLength(1);
    expect(current[0].body).toContain('农历');
    expect(current[0].body).toContain('阳历9月11日');
  });

  test('月历标注的节日和节气进入提醒，同日多节日完整保留', () => {
    const plan = buildNotificationPlan({
      calendar: lunarCalendar,
      people: [],
      countups: [],
      now: Date.parse('2020-09-30T12:00:00+08:00'),
      settings: enabled,
    });
    expect(plan.find((item) => item.date === '2020-10-01')).toMatchObject({
      kind: 'festival',
      title: '今天是中秋节、国庆节',
    });
    expect(plan.find((item) => item.date === '2020-10-08')).toMatchObject({
      kind: 'festival',
      title: '今天是寒露',
    });
  });

  test('节日与生日同日时合并为一条通知', () => {
    const plan = buildNotificationPlan({
      calendar: lunarCalendar,
      people: [fixture('teacher', { name: '老师', lunar: null, solar: { month: 9, day: 10 } })],
      countups: [],
      now: Date.parse('2026-09-10T08:30:00+08:00'),
      settings: enabled,
    });
    const current = plan.filter((item) => item.date === '2026-09-10');
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({
      identifier: 'suisui-combined-2026-09-10',
      kind: 'combined',
      title: '今天有多个重要日子',
    });
    expect(current[0].body).toContain('教师节');
    expect(current[0].body).toContain('老师的生日');
  });

  test('只提醒每年纪念，不提醒普通记录天数，并处理闰日回退', () => {
    const plan = buildNotificationPlan({
      calendar: lunarCalendar,
      people: [],
      countups: [
        countupFixture('days', { title: '每天散步', displayMode: 'days', startDate: '2024-01-01' }),
        countupFixture('anniversary', {
          title: '我们在一起',
          displayMode: 'anniversary',
          startDate: '2024-02-29',
        }),
      ],
      now: Date.parse('2025-02-27T12:00:00+08:00'),
      settings: enabled,
    });
    expect(plan[0]).toMatchObject({
      kind: 'anniversary',
      itemId: 'anniversary',
      date: '2025-02-28',
      title: '今天是「我们在一起」1 周年',
    });
    expect(plan.some((item) => item.itemId === 'days')).toBe(false);
  });

  test('关闭总开关时不排程，并按时间排序后限制为 60 条', () => {
    const people = Array.from({ length: 70 }, (_, index) =>
      fixture(String(index).padStart(2, '0'), { lunar: null, solar: { month: 12, day: 1 } }),
    );
    expect(
      buildNotificationPlan({
        calendar: lunarCalendar,
        people,
        countups: [],
        now: Date.parse('2026-09-10T12:00:00+08:00'),
        settings: { ...enabled, enabled: false },
      }),
    ).toEqual([]);
    const plan = buildNotificationPlan({
      calendar: lunarCalendar,
      people,
      countups: [],
      now: Date.parse('2026-09-10T12:00:00+08:00'),
      settings: enabled,
    });
    expect(plan).toHaveLength(MAX_SCHEDULED_REMINDERS);
    expect(plan.every((item, index) => index === 0 || item.triggerAt >= plan[index - 1].triggerAt)).toBe(
      true,
    );
    const sharedBirthday = plan.find((item) => item.date === '2026-12-01');
    expect(sharedBirthday).toMatchObject({ kind: 'combined', title: '今天有多个重要日子' });
    expect(sharedBirthday?.body).toContain('亲友00的生日');
    expect(sharedBirthday?.body).toContain('亲友69的生日');
  });

  test('设置读取时修复无效值，通知时间始终按北京时间换算', () => {
    expect(normalizeNotificationSettings({ enabled: true, hour: 25, minute: -1 })).toEqual({
      enabled: true,
      hour: 9,
      minute: 0,
    });
    expect(beijingTriggerAt('2026-09-10', { hour: 9, minute: 5 })).toBe(
      Date.parse('2026-09-10T09:05:00+08:00'),
    );
  });
});
