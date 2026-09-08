import {
  birthdayRows,
  birthdayTitle,
  entriesForMonth,
  normalizeDraft,
  occurrenceForYear,
  solarOccurrenceForYear,
  birthdayDates,
  upcoming,
  requireBirthdayType,
  type Birthday,
  type BirthdayDraft,
} from '../src/core/birthday';
import { lunarCalendar } from '../src/core/calendar';
import {
  addDays,
  dayNumber,
  dateInMonth,
  FIRST_DATE,
  LAST_DATE,
  monthGrid,
  shiftMonth,
  supported,
  todayInBeijing,
  untilMidnight,
} from '../src/core/dates';
import { TodayWatcher } from '../src/core/clock';
import {
  anniversaryProgress,
  countupProgress,
  countupProgressText,
  normalizeCountupDraft,
  timeNoteProgressText,
} from '../src/core/countup';

const draft: BirthdayDraft = { name: '妈妈', lunar: { month: 2, day: 1, isLeap: false }, solar: null };
const person = (id: string, value = draft): Birthday => ({
  ...value,
  id,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('时光记规则', () => {
  test('开始当天为第 1 天，跨月和跨年按自然日每天递增', () => {
    expect(countupProgress('2026-09-05', '2026-09-05')).toEqual({
      phase: 'active',
      day: 1,
      elapsed: 0,
    });
    expect(countupProgress('2026-08-31', '2026-09-05')).toEqual({
      phase: 'active',
      day: 6,
      elapsed: 5,
    });
    expect(countupProgress('2025-12-31', '2026-01-01')).toMatchObject({ phase: 'active', day: 2 });
  });

  test('未来开始日显示剩余天数，到当天自动切换累计', () => {
    const item = normalizeCountupDraft({
      type: 'countup',
      title: ' 开始健身 ',
      startDate: '2026-09-08',
      note: ' 每天半小时 ',
    });
    expect(item).toEqual({
      type: 'countup',
      title: '开始健身',
      startDate: '2026-09-08',
      note: '每天半小时',
      displayMode: 'days',
    });
    expect(countupProgressText(item, '2026-09-05')).toBe('3 天后开始');
    expect(countupProgressText(item, '2026-09-08')).toBe('第 1 天');
  });

  test('拒绝空标题、越界日期和过长备注', () => {
    expect(() =>
      normalizeCountupDraft({ type: 'countup', title: ' ', startDate: '2026-09-05', note: '' }),
    ).toThrow('记录名称');
    expect(() =>
      normalizeCountupDraft({ type: 'countup', title: '健身', startDate: '2101-01-01', note: '' }),
    ).toThrow('1901—2100');
    expect(() =>
      normalizeCountupDraft({
        type: 'countup',
        title: '健身',
        startDate: '2026-09-05',
        note: '记'.repeat(121),
      }),
    ).toThrow('120');
  });

  test('每年纪念显示周年和下一次纪念日倒计时', () => {
    const item = normalizeCountupDraft({
      type: 'countup',
      title: '我们在一起',
      startDate: '2025-09-05',
      note: '',
      displayMode: 'anniversary',
    });
    expect(timeNoteProgressText(item, '2026-09-04')).toBe('距 1 周年 1 天');
    expect(timeNoteProgressText(item, '2026-09-05')).toBe('1 周年');
    expect(anniversaryProgress(item.startDate, '2026-09-05')).toEqual({
      phase: 'active',
      years: 1,
      isAnniversary: true,
      nextYears: 2,
      nextDate: '2027-09-05',
      remaining: 365,
    });
    expect(timeNoteProgressText(item, '2026-09-06')).toBe('距 2 周年 364 天');
  });

  test('2 月 29 日在平年按 2 月 28 日纪念，开始当天不显示零周年', () => {
    expect(anniversaryProgress('2024-02-29', '2025-02-28')).toMatchObject({
      phase: 'active',
      years: 1,
      isAnniversary: true,
    });
    expect(
      timeNoteProgressText(
        {
          type: 'countup',
          title: '特别的一天',
          startDate: '2024-02-29',
          note: '',
          displayMode: 'anniversary',
        },
        '2024-02-29',
      ),
    ).toBe('今天开始');
  });
});

describe('农历生日规则', () => {
  test('普通二月不会在闰二月再次过生日；每年重算阳历', () => {
    expect(occurrenceForYear(lunarCalendar, draft.lunar!, 2023).solar).toBe('2023-02-20');
    expect(occurrenceForYear(lunarCalendar, draft.lunar!, 2024).solar).toBe('2024-03-10');
    expect(entriesForMonth(lunarCalendar, [person('a')], '2023-03-01')).toEqual([]);
  });
  test('有闰月使用闰月，没有则回退；先选月份再处理小月', () => {
    const leap = Object.freeze({ ...draft.lunar!, day: 30, isLeap: true });
    expect(occurrenceForYear(lunarCalendar, leap, 2023)).toMatchObject({
      solar: '2023-04-19',
      lunar: { isLeap: true, day: 29 },
      adjustments: ['short-month'],
    });
    expect(occurrenceForYear(lunarCalendar, leap, 2024)).toMatchObject({
      solar: '2024-04-08',
      lunar: { isLeap: false, day: 30 },
      adjustments: ['leap-fallback'],
    });
    expect(occurrenceForYear(lunarCalendar, leap, 2025)).toMatchObject({
      solar: '2025-03-28',
      lunar: { isLeap: false, day: 29 },
      adjustments: ['leap-fallback', 'short-month'],
    });
    expect(leap).toEqual({ month: 2, day: 30, isLeap: true });
  });
  test('春节前从上一农历年计算；当天包含，次日找下一年', () => {
    const birthday = { ...draft, lunar: { month: 12, day: 29, isLeap: false } };
    expect(upcoming(lunarCalendar, birthday, '2024-01-01')[0].solar).toBe('2024-02-08');
    expect(upcoming(lunarCalendar, birthday, '2024-02-08')[0].solar).toBe('2024-02-08');
    expect(upcoming(lunarCalendar, birthday, '2024-02-09')[0].solar).toBe('2025-01-28');
  });
  test('历史月历包含本月已经过去的生日，同日多人不丢失', () => {
    const rows = entriesForMonth(lunarCalendar, [person('a'), person('b')], '2023-02-28');
    expect(rows.map((r) => [r.id, r.occurrence.solar])).toEqual([
      ['a-2023-02-20', '2023-02-20'],
      ['b-2023-02-20', '2023-02-20'],
    ]);
    expect(
      birthdayRows(lunarCalendar, [person('b'), person('a')], '2023-02-20').map((r) => [
        r.person.id,
        r.remaining,
      ]),
    ).toEqual([
      ['a', 0],
      ['b', 0],
    ]);
  });
  test('支持首尾日期；最后一年查不到未来生日时返回空', () => {
    for (const date of [FIRST_DATE, LAST_DATE]) {
      const birthday = { lunar: lunarCalendar.lunarOn(date), solar: null, name: '边界' };
      expect(upcoming(lunarCalendar, birthday, date)[0].solar).toBe(date);
      expect(entriesForMonth(lunarCalendar, [person(date, birthday)], date)).toHaveLength(1);
    }
    expect(upcoming(lunarCalendar, draft, LAST_DATE, 3)).toEqual([]);
    expect(upcoming(lunarCalendar, draft, '2101-01-01')).toEqual([]);
    expect(birthdayRows(lunarCalendar, [person('last')], LAST_DATE)[0]).toMatchObject({
      next: null,
      remaining: null,
    });
  });
  test('2057 年天文台口径同时用于两个方向和小月规则', () => {
    expect(lunarCalendar.lunarOn('2057-09-27')).toMatchObject({ month: 8, day: 29 });
    expect(lunarCalendar.lunarOn('2057-09-28')).toMatchObject({ month: 9, day: 1 });
    expect(lunarCalendar.lunarOn('2057-10-27')).toMatchObject({ month: 9, day: 30 });
    expect(lunarCalendar.lunarOn('2057-10-28')).toMatchObject({ month: 10, day: 1 });
    expect(occurrenceForYear(lunarCalendar, { ...draft.lunar!, month: 8, day: 30 }, 2057)).toMatchObject({
      solar: '2057-09-27',
      adjustments: ['short-month'],
    });
    expect(occurrenceForYear(lunarCalendar, { ...draft.lunar!, month: 9 }, 2057).solar).toBe('2057-09-28');
  });
});

describe('阳历生日与两个都过', () => {
  const both: BirthdayDraft = {
    name: '自己',
    lunar: { month: 12, day: 9, isLeap: false },
    solar: { month: 1, day: 11 },
  };
  test('腊月初九和 1 月 11 日分别按自己的历法跨年重复', () => {
    const dates = upcoming(lunarCalendar, both, '2026-09-05', 6);
    expect(dates.filter((date) => date.kinds.includes('solar')).map((date) => date.solar)).toEqual([
      '2027-01-11',
      '2028-01-11',
      '2029-01-11',
    ]);
    expect(dates[1]).toMatchObject({
      solar: '2027-01-16',
      kinds: ['lunar'],
      lunar: { year: 2026, month: 12, day: 9 },
    });
    expect(birthdayDates(both)).toBe('农历腊月初九 · 阳历1月11日');
    expect(both.solar).toEqual({ month: 1, day: 11 });
  });
  test('阳历生日不调用农历计算，包含当天、次日转入下一年', () => {
    const calendar = {
      ...lunarCalendar,
      lunarOn: jest.fn(() => {
        throw new Error('不应换算');
      }),
    };
    const solar = { ...both, lunar: null };
    expect(upcoming(calendar, solar, '2027-01-11')[0].solar).toBe('2027-01-11');
    expect(upcoming(calendar, solar, '2027-01-12')[0].solar).toBe('2028-01-11');
    expect(calendar.lunarOn).not.toHaveBeenCalled();
  });
  test('同一个人的双生日重合只产生一条事项；同名不同人分别保留', () => {
    const value = { ...draft, lunar: { month: 7, day: 23, isLeap: false }, solar: { month: 9, day: 4 } };
    const dates = upcoming(lunarCalendar, value, '2026-09-04', 3);
    expect(dates).toHaveLength(3);
    expect(dates[0].kinds).toEqual(['lunar', 'solar']);
    expect(new Set(dates.map((date) => date.solar)).size).toBe(3);
    const entries = entriesForMonth(lunarCalendar, [person('a', value), person('b', value)], '2026-09-01');
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.occurrence.kinds.length === 2)).toBe(true);
    expect(birthdayRows(lunarCalendar, [person('a', value)], '2026-09-04')).toHaveLength(1);
  });
  test('同月两天都标注，最近一次排序包含年初上一农历年', () => {
    const entries = entriesForMonth(lunarCalendar, [person('a', both)], '2027-01-31');
    expect(entries.map((entry) => [entry.occurrence.solar, entry.occurrence.kinds])).toEqual([
      ['2027-01-11', ['solar']],
      ['2027-01-16', ['lunar']],
    ]);
    expect(birthdayRows(lunarCalendar, [person('a', both)], '2027-01-12')[0]).toMatchObject({
      remaining: 4,
      next: { kinds: ['lunar'] },
    });
  });
  test.each([2024, 2025, 2100])('2 月 29 日在 %s 年按月末过，始终保留原日期', (year) => {
    const solar = Object.freeze({ month: 2, day: 29 });
    const result = solarOccurrenceForYear(solar, year);
    expect(result.solar).toBe(`${year}-02-${year === 2024 ? '29' : '28'}`);
    expect(result.adjustments).toEqual(year === 2024 ? [] : ['solar-leap-day']);
    expect(solar.day).toBe(29);
  });
  test('双生日同日且农历回退和阳历闰日调整并存，调整信息均保留', () => {
    const lunar = lunarCalendar.lunarOn('2025-02-28');
    const result = upcoming(
      lunarCalendar,
      { name: '双生日', lunar: { ...lunar, isLeap: true }, solar: { month: 2, day: 29 } },
      '2025-02-28',
    )[0];
    expect(result.kinds).toEqual(['lunar', 'solar']);
    expect(result.adjustments).toEqual(['leap-fallback', 'solar-leap-day']);
  });
  test('阳历支持范围首尾不越界，双生日到终点仍只合并同一天', () => {
    for (const date of [FIRST_DATE, LAST_DATE]) {
      const value = {
        name: '边界',
        lunar: lunarCalendar.lunarOn(date),
        solar: { month: Number(date.slice(5, 7)), day: Number(date.slice(8)) },
      };
      expect(upcoming(lunarCalendar, value, date)[0]).toMatchObject({
        solar: date,
        kinds: ['lunar', 'solar'],
      });
    }
    expect(upcoming(lunarCalendar, { ...both, lunar: null }, LAST_DATE, 3)).toEqual([]);
  });
  test.each([
    { month: 2, day: 30 },
    { month: 4, day: 31 },
    { month: 0, day: 1 },
    { month: 13, day: 1 },
    { month: 1, day: 0 },
    { month: 1, day: 1.5 },
    { month: '1', day: 11 },
  ])('拒绝无效阳历月日 %j', (solar) => {
    expect(() => normalizeDraft({ ...both, solar })).toThrow('阳历');
  });
  test('不可保存空的生日方式，切换为阳历时不需要农历字段', () => {
    expect(() => normalizeDraft({ name: '自己', lunar: null, solar: null })).toThrow('至少');
    expect(normalizeDraft({ ...both, lunar: null })).toEqual({
      name: '自己',
      lunar: null,
      solar: { month: 1, day: 11 },
    });
  });
});

describe('输入和日期', () => {
  test.each([
    ['爸爸', '爸爸的生日'],
    ['爸爸生日', '爸爸生日'],
    ['爸爸的生日', '爸爸的生日'],
    ['江源浩生日', '江源浩生日'],
    ['生日快乐的朋友', '生日快乐的朋友的生日'],
  ])('生日标题 %s 显示为 %s，重复格式化不再增加后缀', (name, title) => {
    expect(birthdayTitle(name)).toBe(title);
    expect(birthdayTitle(birthdayTitle(name))).toBe(title);
    expect(normalizeDraft({ ...draft, name }).name).toBe(name);
  });
  test('去除首尾空白、按 Unicode 字符计数，不限制重名', () => {
    expect(normalizeDraft({ ...draft, name: '  妈妈  ' }).name).toBe('妈妈');
    expect(normalizeDraft({ ...draft, name: '🌷'.repeat(30) }).name).toHaveLength(60);
    expect(() => normalizeDraft({ ...draft, name: '🌷'.repeat(31) })).toThrow('30');
  });
  test.each([
    { name: ' ' },
    { name: 12 },
    { lunar: { ...draft.lunar, month: 0 } },
    { lunar: { ...draft.lunar, month: 13 } },
    { lunar: { ...draft.lunar, month: '2' } },
    { lunar: { ...draft.lunar, day: 31 } },
    { lunar: { ...draft.lunar, day: 1.1 } },
    { lunar: { ...draft.lunar, day: 0 } },
    { lunar: { ...draft.lunar, isLeap: 1 } },
  ])('拒绝非法字段 %j', (invalid) => {
    expect(() => normalizeDraft({ ...draft, ...invalid })).toThrow();
  });
  test.each(['schedule', 'anniversary', 'countdown', ''])('业务入口禁止类型 %s', (type) =>
    expect(() => requireBirthdayType(type)).toThrow('尚未开放'),
  );
  test.each(['2026-02-29', '2024-02-30', '2024-2-01', '2024-13-01', 'invalid'])('拒绝非法日期 %s', (date) =>
    expect(() => dayNumber(date)).toThrow(),
  );
  test('闰年、跨年、月末翻页与日历占位正确', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(shiftMonth('2025-12-31', 1)).toBe('2026-01-01');
    expect(dateInMonth('2024-01-31', '2024-02-01')).toBe('2024-02-29');
    const grid = monthGrid('2026-09-01');
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(grid[0].slice(0, 3)).toEqual([null, null, '2026-09-01']);
    expect(supported('1900-12-31')).toBe(false);
    expect(supported('2101-01-01')).toBe(false);
  });
});

describe('北京时间与前台时钟', () => {
  afterEach(() => jest.useRealTimers());
  test('UTC+8 午夜精确切换，不取决于设备时区', () => {
    const instant = Date.parse('2026-09-04T15:59:59.000Z');
    expect(todayInBeijing(instant)).toBe('2026-09-04');
    expect(untilMidnight(instant)).toBe(1000);
    expect(todayInBeijing(instant + 1000)).toBe('2026-09-05');
  });
  test('午夜刷新、暂停清理、恢复补查和系统时间回拨', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T15:59:59Z'));
    const changed = jest.fn();
    const watcher = new TodayWatcher(changed);
    watcher.start();
    expect(changed).toHaveBeenLastCalledWith('2026-09-04');
    jest.advanceTimersByTime(1000);
    expect(changed).toHaveBeenLastCalledWith('2026-09-05');
    watcher.stop();
    expect(jest.getTimerCount()).toBe(0);
    jest.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    watcher.start();
    expect(changed).toHaveBeenLastCalledWith('2026-10-01');
    jest.setSystemTime(new Date('2026-08-01T10:00:00Z'));
    jest.advanceTimersByTime(60_000);
    expect(changed).toHaveBeenLastCalledWith('2026-08-01');
    watcher.stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});
