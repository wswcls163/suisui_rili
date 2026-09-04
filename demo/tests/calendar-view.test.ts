import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALENDAR,
  addDays,
  occurrenceForYear,
} from '../lib/birthday/calendar.ts';
import {
  EVENT_TYPES,
  FIRST_DEMO_DATE,
  LAST_DEMO_DATE,
  birthdayEntries,
  dateInMonth,
  draftFromDate,
  entriesForMonth,
  isSupportedDate,
  isSupportedMonth,
  lunarCellLabel,
  monthStart,
  pickerDate,
  pickerIso,
  shiftMonth,
  validateCreationType,
} from '../lib/birthday/calendar-view.ts';
import {
  birthdayRows,
  demoReducer,
  initialState,
  scenarioOf,
  SCENARIOS,
  visiblePeople,
} from '../lib/birthday/demo-state.ts';

void test('点击阳历日期后预填对应农历，而不是模拟今天的生日', () => {
  assert.deepEqual(draftFromDate('2026-09-16'), {
    name: '',
    month: 8,
    day: 6,
    isLeap: false,
  });
  assert.deepEqual(draftFromDate('2025-07-26'), {
    name: '',
    month: 6,
    day: 2,
    isLeap: true,
  });
  assert.deepEqual(draftFromDate('2025-06-26'), {
    name: '',
    month: 6,
    day: 2,
    isLeap: false,
  });
});

void test('历表内每一天预填的生日都能准确映射回所选日', () => {
  for (const [year, months] of Object.entries(CALENDAR)) {
    for (const month of months) {
      for (let offset = 0; offset < month.days; offset++) {
        const date = addDays(month.start, offset);
        assert.equal(
          occurrenceForYear(draftFromDate(date), Number(year)).solar,
          date,
        );
      }
    }
  }
});

void test('月历展示本月所有生日，包括模拟今天之前的历史生日', () => {
  const people = initialState().people;
  const entries = entriesForMonth(people, '2025-10-01');
  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2025-10-29', '2025-10-29'],
  );
  assert.deepEqual(
    entries.map((entry) => entry.person.id),
    ['mom', 'aunt'],
  );
  assert.equal(entries[0].type, 'birthday');
  assert.equal(entries[0].title, '妈妈的生日');
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  assert.deepEqual(entriesForMonth([], '2026-09-01'), []);
});

void test('阳历年初的月历也展示上一农历年的生日', () => {
  const person = {
    id: 'winter',
    name: '冬日',
    color: 'blue',
    month: 12,
    day: 1,
    isLeap: false,
  };
  const entries = entriesForMonth([person], '2026-01-01');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, '2026-01-19');
  assert.equal(entries[0].occurrence.lunarYear, 2025);
});

void test('月历标记遵守闰月回退、小月提前，不产生普通月与闰月重复生日', () => {
  const people = initialState().people;
  const aunt = people.find((person) => person.id === 'aunt')!;
  const grandma = people.find((person) => person.id === 'grandma')!;
  const brother = people.find((person) => person.id === 'brother')!;
  const fallback = entriesForMonth([aunt], '2026-10-01')[0];
  assert.equal(fallback.date, '2026-10-18');
  assert.equal(fallback.person.isLeap, true);
  assert.equal(fallback.occurrence.actualMonth, 9);
  const short = entriesForMonth([grandma], '2026-04-01')[0];
  assert.equal(short.date, '2026-04-16');
  assert.equal(short.person.day, 30);
  assert.equal(short.occurrence.actualDay, 29);
  const leap = birthdayEntries([brother], '2025-01-01', '2025-12-31');
  assert.equal(leap.length, 1);
  assert.equal(leap[0].date, '2025-07-26');
  assert.deepEqual(entriesForMonth([brother], '2025-06-01'), []);
});

void test('选择日期和翻月只改变浏览状态，不能改变模拟今天或今日提醒', () => {
  const original = initialState();
  const selected = demoReducer(original, {
    type: 'select-date',
    date: '2026-09-16',
  });
  assert.equal(selected.selectedDate, '2026-09-16');
  assert.equal(selected.displayMonth, '2026-09-01');
  assert.equal(scenarioOf(selected).date, '2026-10-18');
  assert.deepEqual(birthdayRows(selected), birthdayRows(original));
  const browsed = demoReducer(selected, {
    type: 'view-month',
    month: '2025-12-01',
  });
  assert.equal(browsed.selectedDate, '2025-12-16');
  assert.equal(browsed.displayMonth, '2025-12-01');
  assert.deepEqual(birthdayRows(browsed), birthdayRows(original));
  assert.equal(original.selectedDate, '2026-10-18');
});

void test('选日期、新建、编辑和删除后月历与生日簿使用同一批记录', () => {
  let state = demoReducer(initialState(), {
    type: 'select-date',
    date: '2026-09-16',
  });
  const beforeToday = birthdayRows(state).filter(
    (row) => row.remaining === 0,
  ).length;
  validateCreationType('birthday');
  state = demoReducer(state, {
    type: 'save',
    id: 'new',
    draft: { ...draftFromDate(state.selectedDate), name: '新亲友' },
  });
  let entry = entriesForMonth(visiblePeople(state), state.displayMonth).find(
    (item) => item.person.id === 'new',
  )!;
  assert.equal(entry.date, '2026-09-16');
  assert.equal(entry.person.month, 8);
  assert.equal(
    birthdayRows(state).filter((row) => row.remaining === 0).length,
    beforeToday,
  );
  assert.ok(birthdayRows(state).some((row) => row.person.id === 'new'));
  state = demoReducer(state, {
    type: 'save',
    id: 'new',
    draft: { name: '新称呼', month: 8, day: 7, isLeap: false },
  });
  entry = entriesForMonth(visiblePeople(state), state.displayMonth).find(
    (item) => item.person.id === 'new',
  )!;
  assert.equal(entry.date, '2026-09-17');
  assert.equal(entry.title, '新称呼的生日');
  state = demoReducer(state, { type: 'delete', id: 'new' });
  assert.ok(
    !entriesForMonth(visiblePeople(state), state.displayMonth).some(
      (item) => item.person.id === 'new',
    ),
  );
  assert.ok(!birthdayRows(state).some((row) => row.person.id === 'new'));
});

void test('翻月处理三十一日、闰年二月、跨年与演示边界', () => {
  assert.equal(dateInMonth('2026-01-31', '2026-02-01'), '2026-02-28');
  assert.equal(dateInMonth('2028-01-31', '2028-02-01'), '2028-02-29');
  assert.equal(dateInMonth('2026-03-31', '2026-04-01'), '2026-04-30');
  assert.equal(shiftMonth('2026-12-01', 1), '2027-01-01');
  assert.equal(shiftMonth('2026-01-01', -1), '2025-12-01');
  assert.equal(dateInMonth('2026-10-18', '2025-01-01'), FIRST_DEMO_DATE);
  assert.equal(dateInMonth('2026-10-31', '2029-02-01'), LAST_DEMO_DATE);
  assert.throws(() => dateInMonth('2026-10-18', '2024-12-01'));
  assert.throws(() => dateInMonth('2026-10-18', '2029-03-01'));
});

void test('DatePicker按本地日期字段往返，不被UTC转换挪到前后一天', () => {
  for (const iso of [
    '2026-09-01',
    '2026-09-16',
    '2028-02-29',
    '2026-03-08',
    '2026-11-01',
  ]) {
    assert.equal(pickerIso(pickerDate(iso)), iso);
    const [year, month, day] = iso.split('-').map(Number);
    assert.equal(pickerIso(new Date(year, month - 1, day)), iso);
  }
  assert.equal(pickerDate('2026-09-01').getDay(), 2);
  assert.equal(pickerDate('2026-10-01').getDay(), 4);
  assert.throws(() => pickerIso(new Date('invalid')));
});

void test('农历初一显示月份，普通与闰月标记分别准确', () => {
  assert.equal(lunarCellLabel('2026-09-11'), '八月');
  assert.equal(lunarCellLabel('2026-09-16'), '初六');
  assert.equal(lunarCellLabel('2025-07-25'), '闰六月');
  assert.equal(lunarCellLabel('2025-06-25'), '六月');
  assert.equal(lunarCellLabel('2024-01-01'), '范围外');
});

void test('有限历表外的日期不可选，边缘月只开放已覆盖日期', () => {
  assert.equal(FIRST_DEMO_DATE, '2025-01-29');
  assert.equal(LAST_DEMO_DATE, '2029-02-12');
  for (const iso of [FIRST_DEMO_DATE, LAST_DEMO_DATE, '2028-02-29'])
    assert.ok(isSupportedDate(iso));
  for (const iso of ['2025-01-28', '2029-02-13', '2026-02-30', 'bad']) {
    assert.equal(isSupportedDate(iso), false);
    assert.throws(() =>
      demoReducer(initialState(), { type: 'select-date', date: iso }),
    );
    assert.throws(() => draftFromDate(iso));
  }
  assert.ok(isSupportedMonth('2025-01-01'));
  assert.ok(isSupportedMonth('2029-02-01'));
  assert.equal(isSupportedMonth('2029-03-01'), false);
  assert.equal(isSupportedMonth('bad'), false);
  assert.throws(() => monthStart('2026-02-30'));
  assert.throws(() => birthdayEntries([], '2026-02-01', '2026-01-01'));
});

void test('事项类型目前仅开放生日，预留类型不能被误保存', () => {
  assert.deepEqual(
    EVENT_TYPES.filter((type) => type.available).map((type) => type.id),
    ['birthday'],
  );
  assert.doesNotThrow(() => validateCreationType('birthday'));
  for (const type of ['schedule', 'anniversary', 'countdown', '', 'unknown'])
    assert.throws(() => validateCreationType(type));
});

void test('切换演示场景会同步回到场景当天，重置会恢复月历状态', () => {
  for (const scenario of SCENARIOS) {
    const state = demoReducer(initialState(), {
      type: 'scenario',
      id: scenario.id,
    });
    assert.equal(state.selectedDate, scenario.date);
    assert.equal(state.displayMonth, monthStart(scenario.date));
  }
  const selected = demoReducer(initialState(), {
    type: 'select-date',
    date: '2026-09-16',
  });
  const reset = demoReducer(selected, { type: 'reset' });
  assert.deepEqual(reset, initialState());
});
