import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BirthdayForm } from '../src/components/BirthdayForm';
import { MonthCalendar } from '../src/components/MonthCalendar';
import { AppProvider } from '../src/state/AppProvider';
import Home from '../app/index';
import NewBirthday from '../app/new';
import BirthdayDetails from '../app/birthday/[id]';
import { entriesForMonth } from '../src/core/birthday';
import { lunarCalendar } from '../src/core/calendar';
import { fixture, memoryRepository } from './helpers';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ id: 'a' }),
}));
const today = '2026-09-04';
test('新建先选择类型，预填所选闰月日期；未开放类型不可点击', async () => {
  const save = jest.fn(async () => {});
  render(<BirthdayForm selectedDate="2023-03-22" today={today} onSave={save} onCancel={() => {}} />);
  expect(screen.getByRole('button', { name: '保存生日' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '普通日程 · 后续开放' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: '生日' }));
  expect(screen.getByLabelText('农历月份：二月')).toBeTruthy();
  expect(screen.getByLabelText('农历日期：初一')).toBeTruthy();
  expect(screen.getByLabelText('这是闰月生日').props.value).toBe(true);
  fireEvent.changeText(screen.getByLabelText('姓名或称呼'), '  妈妈  ');
  fireEvent.press(screen.getByRole('button', { name: '保存生日' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ name: '妈妈', month: 2, day: 1, isLeap: true }, 'birthday'),
  );
});
test('校验长称呼不崩溃；失败保留输入、支持重试且阻止连点保存', async () => {
  const save = jest.fn(async () => {}).mockRejectedValueOnce(new Error('存储空间不足'));
  render(<BirthdayForm selectedDate={today} today={today} onSave={save} onCancel={() => {}} />);
  fireEvent.press(screen.getByRole('button', { name: '生日' }));
  fireEvent.changeText(screen.getByLabelText('姓名或称呼'), '亲'.repeat(31));
  fireEvent.press(screen.getByRole('button', { name: '保存生日' }));
  expect(screen.getByText('称呼不能超过 30 个字符')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('姓名或称呼'), '妈妈');
  fireEvent.press(screen.getByRole('button', { name: '保存生日' }));
  await screen.findByText('存储空间不足');
  expect(screen.getByLabelText('姓名或称呼').props.value).toBe('妈妈');
  let finish!: () => void;
  save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.press(screen.getByRole('button', { name: '保存生日' }));
  fireEvent.press(screen.getByRole('button', { name: '保存生日' }));
  expect(save).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '保存生日' })).toBeDisabled();
  await act(async () => finish());
});
test('编辑回填原始闰月三十，预览调整不改变原始输入', () => {
  render(
    <BirthdayForm
      person={fixture('a', { month: 2, day: 30, isLeap: true })}
      selectedDate={today}
      today="2025-01-01"
      onSave={async () => {}}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByLabelText('农历日期：三十')).toBeTruthy();
  expect(screen.getByLabelText('这是闰月生日').props.value).toBe(true);
  expect(screen.getByText('2025.03.28')).toBeTruthy();
  expect(screen.getByText('本月只有二十九天，提前到二十九提醒')).toBeTruthy();
});
test('月历七列、选日回调和多人标记；首尾月份禁止越界', () => {
  const select = jest.fn();
  const entries = entriesForMonth(lunarCalendar, [fixture('a'), fixture('b')], today);
  const { rerender } = render(
    <MonthCalendar
      month="2026-09-01"
      today={today}
      selected={today}
      entries={entries}
      onSelect={select}
      onMonth={() => {}}
      onToday={() => {}}
    />,
  );
  const day = screen.getByRole('button', { name: /2026-09-04.*2/ });
  fireEvent.press(day);
  expect(select).toHaveBeenCalledWith(today);
  rerender(
    <MonthCalendar
      month="1901-01-01"
      today={today}
      selected="1901-01-01"
      entries={[]}
      onSelect={select}
      onMonth={() => {}}
      onToday={() => {}}
    />,
  );
  expect(screen.getByRole('button', { name: '上个月' })).toBeDisabled();
  rerender(
    <MonthCalendar
      month="2100-12-01"
      today={today}
      selected="2100-12-31"
      entries={[]}
      onSelect={select}
      onMonth={() => {}}
      onToday={() => {}}
    />,
  );
  expect(screen.getByRole('button', { name: '下个月' })).toBeDisabled();
});
const clock = { now: () => Date.parse(`${today}T04:00:00Z`) };

test('节日同日保留生日姓名与完整无障碍日期，选择后显示全部节日', async () => {
  const repo = memoryRepository([fixture('a', { name: '团圆', month: 8, day: 15 })]);
  render(
    <AppProvider repo={repo} clock={{ now: () => Date.parse('2020-10-02T04:00:00Z') }}>
      <Home />
    </AppProvider>,
  );
  const date = await screen.findByRole('button', {
    name: '2020-10-01，农历八月十五，中秋、国庆，1 位生日：团圆',
  });
  expect(within(date).getByText('中秋')).toBeTruthy();
  expect(within(date).getByText('+1')).toBeTruthy();
  expect(within(date).getByText('团圆')).toBeTruthy();
  fireEvent.press(date);
  expect(screen.getAllByText('中秋', { exact: true })).toHaveLength(2);
  expect(screen.getByText('国庆', { exact: true })).toBeTruthy();
  expect(screen.getByText('2020 农历年 · 八月十五')).toBeTruthy();
  expect(screen.getByRole('button', { name: '查看团圆的生日详情' })).toBeTruthy();
  expect(screen.getByText('今天没有生日提醒')).toBeTruthy();
});

test('小年与节气同日时保留数量提示，选日展示全部名称', async () => {
  render(
    <AppProvider repo={memoryRepository()} clock={{ now: () => Date.parse('2017-01-20T04:00:00Z') }}>
      <Home />
    </AppProvider>,
  );
  const date = await screen.findByRole('button', { name: '2017-01-20，农历腊月廿三，北方小年、大寒' });
  expect(within(date).getByText('北小年')).toBeTruthy();
  expect(screen.getByText('北方小年')).toBeTruthy();
  expect(within(date).getByText('+1')).toBeTruthy();
  expect(screen.getByText('大寒')).toBeTruthy();
  expect(screen.getByText('今天没有生日提醒')).toBeTruthy();
});

test('长纪念日名称在网格用简称，选日和无障碍标签显示完整名称', async () => {
  render(
    <AppProvider repo={memoryRepository()} clock={{ now: () => Date.parse('2026-09-18T04:00:00Z') }}>
      <Home />
    </AppProvider>,
  );
  const date = await screen.findByRole('button', { name: /2026-09-18.*九一八事变纪念日/ });
  expect(within(date).getByText('九一八')).toBeTruthy();
  expect(screen.getByText('九一八事变纪念日')).toBeTruthy();
  expect(screen.getByText('今天没有生日提醒')).toBeTruthy();
});

test('直接打开新建页遇到读库失败时给出重试入口', async () => {
  const repo = memoryRepository();
  repo.initialize.mockRejectedValueOnce(new Error('数据库不可用'));
  render(
    <AppProvider repo={repo} clock={clock}>
      <NewBirthday />
    </AppProvider>,
  );
  await screen.findByText('数据库不可用');
  fireEvent.press(screen.getByRole('button', { name: '重新读取' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '生日' })).toBeEnabled());
});
test('首页首次使用为空，无虚构亲友；同日多人全部提醒', async () => {
  const empty = render(
    <AppProvider repo={memoryRepository()} clock={clock}>
      <Home />
    </AppProvider>,
  );
  await screen.findByText('今天没有生日提醒');
  expect(screen.getByRole('button', { name: '添加第一个生日' })).toBeTruthy();
  empty.unmount();
  render(
    <AppProvider repo={memoryRepository([fixture('a'), fixture('b')])} clock={clock}>
      <Home />
    </AppProvider>,
  );
  await screen.findByText('今天有 2 位亲友过生日');
  expect(screen.getByRole('button', { name: '今天：亲友a的生日' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '今天：亲友b的生日' })).toBeTruthy();
});
test('详情删除需要确认，取消不写库；失败保留记录，成功才返回', async () => {
  const repo = memoryRepository([fixture('a')]);
  render(
    <AppProvider repo={repo} clock={clock}>
      <BirthdayDetails />
    </AppProvider>,
  );
  await screen.findByRole('button', { name: '删除生日' });
  fireEvent.press(screen.getByRole('button', { name: '删除生日' }));
  fireEvent.press(screen.getByRole('button', { name: '取消' }));
  expect(repo.remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: '删除生日' }));
  repo.remove.mockRejectedValueOnce(new Error('删除失败，请重试'));
  fireEvent.press(screen.getByRole('button', { name: '确认删除' }));
  await screen.findByText('删除失败，请重试');
  expect(router.back).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(repo.remove).toHaveBeenCalledTimes(2);
});
