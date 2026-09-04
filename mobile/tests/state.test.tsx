import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppProvider, useBirthdays } from '../src/state/AppProvider';
import { fixture, memoryRepository } from './helpers';

const now = Date.parse('2026-09-04T04:00:00Z'); // 农历七月廿三
function mount(repo = memoryRepository(), clock = { now: () => now }) {
  return renderHook(useBirthdays, {
    wrapper: ({ children }) => (
      <AppProvider repo={repo} clock={clock}>
        {children}
      </AppProvider>
    ),
  });
}
test('空库明确就绪；真实今天与选日、翻月互不覆盖', async () => {
  const { result } = mount(memoryRepository([fixture('a'), fixture('b'), fixture('c', { day: 24 })]));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.todayRows.map((r) => r.person.id)).toEqual(['a', 'b']);
  act(() => result.current.selectDate('2024-02-29'));
  act(() => result.current.viewMonth('2024-03-01'));
  expect(result.current.selectedDate).toBe('2024-03-29');
  expect(result.current.today).toBe('2026-09-04');
  expect(result.current.todayRows).toHaveLength(2);
});
test('加载错误不伪装空库，允许重试；CRUD 成功后同步提醒', async () => {
  const repo = memoryRepository();
  repo.initialize.mockRejectedValueOnce(new Error('无法打开数据库'));
  const { result } = mount(repo);
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.error).toBe('无法打开数据库');
  await act(() => result.current.reload());
  expect(result.current.status).toBe('ready');
  expect(result.current.people).toEqual([]);
  await act(() => result.current.save(fixture('ignored')));
  expect(result.current.todayRows).toHaveLength(1);
  const id = result.current.people[0].id;
  await act(() => result.current.save(fixture(id, { day: 24 }), id));
  expect(result.current.todayRows).toHaveLength(0);
  await act(() => result.current.remove(id));
  expect(result.current.people).toEqual([]);
});
test('保存、删除失败不污染共享状态；拒绝重复写入和未开放类型', async () => {
  const repo = memoryRepository([fixture('a')]);
  const { result } = mount(repo);
  await waitFor(() => expect(result.current.status).toBe('ready'));
  repo.update.mockRejectedValueOnce(new Error('磁盘已满'));
  await act(async () => {
    await expect(result.current.save(fixture('a', { name: '新名字' }), 'a')).rejects.toThrow('磁盘已满');
  });
  expect(result.current.people[0].name).toBe('亲友a');
  repo.remove.mockRejectedValueOnce(new Error('删除失败'));
  await act(async () => {
    await expect(result.current.remove('a')).rejects.toThrow('删除失败');
  });
  expect(result.current.todayRows).toHaveLength(1);
  await expect(result.current.save(fixture('x'), undefined, 'schedule')).rejects.toThrow('尚未开放');
  expect(repo.create).not.toHaveBeenCalled();
  let finish!: (value: ReturnType<typeof fixture>) => void;
  repo.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let writing!: Promise<void>;
  act(() => {
    writing = result.current.save(fixture('x'));
  });
  await expect(result.current.save(fixture('y'))).rejects.toThrow('正在保存');
  expect(repo.create).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(fixture('x'));
    await writing;
  });
  expect(result.current.busy).toBe(false);
});
test('后台恢复、首页刷新和成功写入都会重新读取时钟', async () => {
  let value = now;
  let onState!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onState = listener;
    return { remove };
  });
  const repo = memoryRepository([fixture('a'), fixture('b', { day: 24 })]);
  const { result, unmount } = mount(repo, { now: () => value });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  act(() => onState('background'));
  value = Date.parse('2026-09-05T04:00:00Z');
  act(() => onState('active'));
  expect(result.current.todayRows.map((r) => r.person.id)).toEqual(['b']);
  expect(result.current.selectedDate).toBe('2026-09-04');
  value = now;
  act(() => result.current.refreshToday());
  expect(result.current.todayRows.map((r) => r.person.id)).toEqual(['a']);
  value = Date.parse('2026-09-05T04:00:00Z');
  await act(() => result.current.save(fixture('c', { day: 24 })));
  expect(result.current.todayRows).toHaveLength(2);
  unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  subscription.mockRestore();
});
