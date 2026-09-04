import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  demoReducer,
  birthdayRows,
  visiblePeople,
  normalizeDraft,
  SCENARIOS,
} from '../lib/birthday/demo-state.ts';

void test('默认场景显示全部当天生日并正确排序', () => {
  const rows = birthdayRows(initialState());
  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.filter((r) => r.remaining === 0).map((r) => r.person.name),
    ['妈妈', '小姨'],
  );
  assert.ok(
    rows.every((r, i) => i === 0 || r.remaining >= rows[i - 1].remaining),
  );
});
void test('所有演示场景都能计算，生日人数符合场景', () => {
  const counts = { today: 2, ordinary: 0, leap: 1, short: 1, empty: 0 };
  for (const scenario of SCENARIOS) {
    const state = demoReducer(initialState(), {
      type: 'scenario',
      id: scenario.id,
    });
    assert.equal(
      birthdayRows(state).filter((r) => r.remaining === 0).length,
      counts[scenario.id],
    );
  }
});
void test('添加、编辑和删除即时更新当天提醒，不修改旧状态', () => {
  const original = initialState();
  const added = demoReducer(original, {
    type: 'save',
    id: 'new',
    draft: { name: '  测试亲友  ', month: 9, day: 9, isLeap: false },
  });
  assert.equal(visiblePeople(original).length, 6);
  assert.equal(visiblePeople(added).length, 7);
  assert.equal(birthdayRows(added).filter((r) => r.remaining === 0).length, 3);
  assert.equal(visiblePeople(added).at(-1)?.name, '测试亲友');
  const edited = demoReducer(added, {
    type: 'save',
    id: 'new',
    draft: { name: '新的称呼', month: 9, day: 10, isLeap: false },
  });
  assert.equal(visiblePeople(edited).length, 7);
  assert.equal(birthdayRows(edited).filter((r) => r.remaining === 0).length, 2);
  assert.equal(
    birthdayRows(edited).find((r) => r.person.id === 'new')?.remaining,
    1,
  );
  const deleted = demoReducer(edited, { type: 'delete', id: 'mom' });
  assert.equal(
    birthdayRows(deleted).filter((r) => r.remaining === 0).length,
    1,
  );
});
void test('输入验证失败不会保存半条记录', () => {
  const original = initialState();
  for (const draft of [
    { name: ' ', month: 9, day: 9, isLeap: false },
    { name: 'a'.repeat(31), month: 9, day: 9, isLeap: false },
    { name: '测试', month: 0, day: 9, isLeap: false },
    { name: '测试', month: 9, day: 31, isLeap: false },
    { name: '测试', month: 1.5, day: 1, isLeap: false },
  ])
    assert.throws(() => normalizeDraft(draft));
  assert.equal(original.people.length, 6);
});
void test('首次使用场景允许添加，切换场景不会丢失当前页面的修改', () => {
  const empty = demoReducer(initialState(), { type: 'scenario', id: 'empty' });
  const added = demoReducer(empty, {
    type: 'save',
    id: 'first',
    draft: { name: '第一位', month: 9, day: 9, isLeap: false },
  });
  assert.equal(visiblePeople(added).length, 1);
  const today = demoReducer(added, { type: 'scenario', id: 'today' });
  assert.equal(visiblePeople(today).length, 6);
  assert.equal(
    visiblePeople(demoReducer(today, { type: 'scenario', id: 'empty' })).length,
    1,
  );
});
void test('重置恢复初始数据，所有副本互不影响', () => {
  const initial = initialState();
  initial.people[0].name = '被改动的称呼';
  assert.equal(initialState().people[0].name, '妈妈');
  assert.deepEqual(demoReducer(initial, { type: 'reset' }), initialState());
});
