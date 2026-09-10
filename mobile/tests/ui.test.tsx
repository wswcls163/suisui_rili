import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BirthdayForm } from '../src/components/BirthdayForm';
import { CountupForm } from '../src/components/CountupForm';
import { DateCalculatorDialog } from '../src/components/DateCalculatorDialog';
import { MonthCalendar } from '../src/components/MonthCalendar';
import { AppProvider } from '../src/state/AppProvider';
import Home, { homeLayoutWidth } from '../app/index';
import NewBirthday from '../app/new';
import BirthdayDetails from '../app/birthday/[id]';
import CountupDetails from '../app/countup/[id]';
import { entriesForMonth } from '../src/core/birthday';
import { lunarCalendar } from '../src/core/calendar';
import { countupFixture, fixture, memoryRepository } from './helpers';

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
test('电脑手机预览参数固定使用 443 像素布局宽度', () => {
  expect(homeLayoutWidth(1440, 'web', '?preview=phone')).toBe(443);
  expect(homeLayoutWidth(1440, 'web', '')).toBe(1440);
  expect(homeLayoutWidth(390, 'android', '?preview=phone')).toBe(390);
});

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
    expect(save).toHaveBeenCalledWith(
      { name: '妈妈', lunar: { month: 2, day: 1, isLeap: true }, solar: null },
      'birthday',
    ),
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
      person={fixture('a', { lunar: { month: 2, day: 30, isLeap: true } })}
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
test('时光记默认记录天数，预填开始日期并保存', async () => {
  const save = jest.fn(async () => {});
  render(<CountupForm selectedDate="2026-09-04" today="2026-09-04" onSave={save} onCancel={() => {}} />);
  expect(screen.getByText('第 1 天')).toBeTruthy();
  expect(screen.getByRole('button', { name: '选择开始日期：2026.09.04' })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('记录名称'), ' 开始健身 ');
  fireEvent.changeText(screen.getByLabelText('时光记备注'), ' 每天半小时 ');
  fireEvent.press(screen.getByRole('button', { name: '保存时光记' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      type: 'countup',
      title: '开始健身',
      startDate: '2026-09-04',
      note: '每天半小时',
      displayMode: 'days',
    }),
  );
});

test('时光记可切换为每年纪念并预览周年', async () => {
  const save = jest.fn(async () => {});
  render(<CountupForm selectedDate="2025-09-04" today="2026-09-04" onSave={save} onCancel={() => {}} />);
  fireEvent.press(screen.getByRole('button', { name: '每年纪念' }));
  expect(screen.getByText('1 周年')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('记录名称'), ' 我们在一起 ');
  fireEvent.press(screen.getByRole('button', { name: '保存时光记' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      type: 'countup',
      title: '我们在一起',
      startDate: '2025-09-04',
      note: '',
      displayMode: 'anniversary',
    }),
  );
});

function enterCalculatorDate(year: string, month: string, day: string) {
  fireEvent.changeText(screen.getByLabelText('年份'), year);
  fireEvent.changeText(screen.getByLabelText('月份'), month);
  fireEvent.changeText(screen.getByLabelText('日期'), day);
}

test('日期计算的月份和日期无需前导零，并立即计算到今天的天数', () => {
  const close = jest.fn();
  render(<DateCalculatorDialog today="2026-09-08" onClose={close} />);
  enterCalculatorDate('2016', '7', '1');
  expect(screen.getByLabelText('月份').props.value).toBe('7');
  expect(screen.getByLabelText('日期').props.value).toBe('1');
  expect(screen.getByText('2016年7月1日 距今天')).toBeTruthy();
  expect(screen.getByText('已经过去 3721 天')).toBeTruthy();
  expect(screen.getByText('约 10.19 年')).toBeTruthy();
  expect(screen.getByText('仅用于本次查询，不会保存，也不会参与同步。')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '完成' }));
  expect(close).toHaveBeenCalledTimes(1);
});

test('删除月份数字不会把日期数字串到月份中', () => {
  render(<DateCalculatorDialog today="2026-09-08" onClose={() => {}} />);
  enterCalculatorDate('2020', '3', '5');
  fireEvent.changeText(screen.getByLabelText('月份'), '');
  expect(screen.getByLabelText('月份').props.value).toBe('');
  expect(screen.getByLabelText('日期').props.value).toBe('5');
  expect(screen.queryByText(/已经过去/)).toBeNull();
  fireEvent.changeText(screen.getByLabelText('月份'), '4');
  expect(screen.getByText('2020年4月5日 距今天')).toBeTruthy();
});

test('日期计算校验无效日期，并能识别今天和未来日期', () => {
  render(<DateCalculatorDialog today="2026-09-08" onClose={() => {}} />);
  enterCalculatorDate('2021', '2', '29');
  expect(screen.getByText('请输入 1901—2100 年内的有效日期')).toBeTruthy();
  expect(screen.queryByText(/已经过去/)).toBeNull();
  enterCalculatorDate('2026', '9', '8');
  expect(screen.getByText('就是今天')).toBeTruthy();
  expect(screen.getByText('0 年')).toBeTruthy();
  enterCalculatorDate('2026', '9', '18');
  expect(screen.getByText('距离那天还有 10 天')).toBeTruthy();
  expect(screen.getByText('约 0.03 年')).toBeTruthy();
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
      compact
    />,
  );
  const day = screen.getByRole('button', { name: /2026-09-04.*2/ });
  expect(day).toHaveStyle({ minHeight: 74, marginVertical: 1, paddingVertical: 4 });
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

test('滚轮跳转具体日期同步月份、选中状态和详情，保留真实今天提醒；重新打开预选最新日期', async () => {
  render(
    <AppProvider repo={memoryRepository([fixture('a')])} clock={clock}>
      <Home />
    </AppProvider>,
  );
  await screen.findByText('今天有 1 位亲友过生日');
  fireEvent.press(screen.getByRole('button', { name: '跳转日期' }));
  fireEvent.press(screen.getByRole('button', { name: '2024 年' }));
  fireEvent.press(screen.getByRole('button', { name: '2 月' }));
  fireEvent.press(screen.getByRole('button', { name: '29 日' }));
  fireEvent.press(screen.getByRole('button', { name: '跳转' }));
  expect(screen.getByRole('button', { name: /2024-02-29，农历/ }).props.accessibilityState.selected).toBe(
    true,
  );
  expect(screen.getByRole('button', { name: '在 2024-02-29 新建事项' })).toBeTruthy();
  expect(screen.getByText('今天有 1 位亲友过生日')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '跳转' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: '跳转日期' }));
  expect(screen.getByLabelText('日期').props.accessibilityValue.now).toBe(29);
  fireEvent.press(screen.getByRole('button', { name: '2025 年' }));
  fireEvent.press(screen.getByRole('button', { name: '取消' }));
  expect(screen.getByRole('button', { name: '在 2024-02-29 新建事项' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '跳转日期' }));
  expect(screen.getByLabelText('年份').props.accessibilityValue.now).toBe(2024);
  expect(screen.getByLabelText('日期').props.accessibilityValue.now).toBe(29);
});

test('节日同日保留生日姓名与完整无障碍日期，选择后显示全部节日', async () => {
  const repo = memoryRepository([
    fixture('a', { name: '团圆', lunar: { month: 8, day: 15, isLeap: false } }),
  ]);
  render(
    <AppProvider repo={repo} clock={{ now: () => Date.parse('2020-10-02T04:00:00Z') }}>
      <Home />
    </AppProvider>,
  );
  const date = await screen.findByRole('button', {
    name: '2020-10-01，农历八月十五，中秋节、国庆节，1 位生日：团圆的生日',
  });
  expect(within(date).getByText('中秋节')).toBeTruthy();
  expect(within(date).getByText('+1')).toBeTruthy();
  expect(within(date).getByText('团圆的生日')).toBeTruthy();
  expect(within(date).getAllByTestId('birthday-cake')).toHaveLength(1);
  expect(
    within(screen.getByRole('button', { name: /2020-10-02，/ })).queryByTestId('birthday-cake'),
  ).toBeNull();
  fireEvent.press(date);
  expect(screen.getAllByText('中秋节', { exact: true })).toHaveLength(2);
  expect(screen.getByText('国庆节', { exact: true })).toBeTruthy();
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
  expect(within(date).getByText('北方小年')).toHaveStyle({ fontSize: 10 });
  expect(screen.getAllByText('北方小年')).toHaveLength(2);
  expect(within(date).getByText('+1')).toBeTruthy();
  expect(screen.getByText('大寒')).toBeTruthy();
  expect(screen.getByText('今天没有生日提醒')).toBeTruthy();
});

test.each([
  ['2026-02-10', '北方小年'],
  ['2026-02-11', '南方小年'],
  ['2026-08-15', '日本投降日'],
  ['2026-09-03', '抗战胜利纪念日'],
  ['2026-09-18', '九一八事变'],
  ['2026-09-25', '中秋节'],
  ['2026-10-01', '国庆节'],
])('%s 的 %s 使用原字号和尾部省略，选日仍显示完整名称', async (date, name) => {
  render(
    <AppProvider repo={memoryRepository()} clock={{ now: () => Date.parse(`${date}T04:00:00Z`) }}>
      <Home />
    </AppProvider>,
  );
  const day = await screen.findByRole('button', { name: new RegExp(`${date}.*${name}`) });
  const label = within(day).getByText(name);
  expect(label).toHaveStyle({ fontSize: 10 });
  expect(label.props.numberOfLines).toBe(1);
  expect(label.props.ellipsizeMode).toBe('tail');
  expect(screen.getAllByText(name, { exact: true })).toHaveLength(2);
  expect(screen.getByText('今天没有生日提醒')).toBeTruthy();
});

test.each([
  ['爸爸', '爸爸的生日'],
  ['爸爸生日', '爸爸生日'],
  ['爸爸的生日', '爸爸的生日'],
])('姓名 %s 在月历、事项、提醒和生日簿中统一显示 %s', async (name, title) => {
  const repo = memoryRepository([fixture('a', { name }), fixture('b', { name: '江源浩生日' })]);
  render(
    <AppProvider repo={repo} clock={clock}>
      <Home />
    </AppProvider>,
  );
  const day = await screen.findByRole('button', { name: /2026-09-04.*2 位生日/ });
  expect(within(day).getByText(`${title} +1`)).toBeTruthy();
  const entry = screen.getByRole('button', { name: `查看${title}详情` });
  expect(within(entry).getByText(title)).toBeTruthy();
  expect(screen.getByRole('button', { name: '查看江源浩生日详情' })).toBeTruthy();
  expect(screen.getByRole('button', { name: `今天：${title}` })).toBeTruthy();
  expect(screen.queryByText(/生日的生日/)).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: '生日簿 2' }));
  expect(within(screen.getByRole('button', { name: `查看${title}` })).getByText(title)).toBeTruthy();
  expect(repo.create).not.toHaveBeenCalled();
  expect(repo.update).not.toHaveBeenCalled();
});

test.each([
  ['爸爸', '爸爸的生日'],
  ['爸爸生日', '爸爸生日'],
  ['爸爸的生日', '爸爸的生日'],
])('详情和删除提示使用 %s 的统一标题，编辑保留原始输入', async (name, title) => {
  const repo = memoryRepository([fixture('a', { name })]);
  render(
    <AppProvider repo={repo} clock={clock}>
      <BirthdayDetails />
    </AppProvider>,
  );
  await screen.findByText(title, { exact: true });
  fireEvent.press(screen.getByRole('button', { name: '删除生日' }));
  expect(screen.getByText(`删除「${title}」？`)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '取消' }));
  fireEvent.press(screen.getByRole('button', { name: '编辑生日' }));
  expect(screen.getByLabelText('姓名或称呼').props.value).toBe(name);
  expect(repo.remove).not.toHaveBeenCalled();
  expect(repo.update).not.toHaveBeenCalled();
});

test('已有农历生日开启两个都过，明确填写阳历且只保存一条记录', async () => {
  const save = jest.fn(async () => {});
  render(
    <BirthdayForm
      person={fixture('a', { lunar: { month: 12, day: 9, isLeap: false } })}
      selectedDate={today}
      today={today}
      onSave={save}
      onCancel={() => {}}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: '两个都过' }));
  expect(screen.getByRole('button', { name: '两个都过' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('农历日期：初九')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '保存修改' }));
  expect(screen.getByText('请选择有效的阳历月份')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('阳历月份：请选择'));
  fireEvent.press(screen.getByRole('button', { name: '1 月' }));
  fireEvent.press(screen.getByLabelText('阳历日期：请选择'));
  fireEvent.press(screen.getByRole('button', { name: '11 日' }));
  expect(screen.getByText('2027.01.11')).toBeTruthy();
  expect(screen.getByText('2027.01.16')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('农历日期：初九'));
  fireEvent.press(screen.getByRole('button', { name: '初十' }));
  expect(screen.getByText('2027.01.11')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '只过农历' }));
  fireEvent.press(screen.getByRole('button', { name: '两个都过' }));
  expect(screen.getByLabelText('阳历日期：11 日')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '保存修改' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      { name: '亲友a', lunar: { month: 12, day: 10, isLeap: false }, solar: { month: 1, day: 11 } },
      'birthday',
    ),
  );
  expect(save).toHaveBeenCalledTimes(1);
});

test('仅阳历独立编辑，月份变化收敛到有效日期，平年闰日显示说明', async () => {
  const save = jest.fn(async () => {});
  render(
    <BirthdayForm
      person={fixture('a', { lunar: null, solar: { month: 1, day: 31 } })}
      selectedDate={today}
      today={today}
      onSave={save}
      onCancel={() => {}}
    />,
  );
  expect(screen.queryByLabelText('这是闰月生日')).toBeNull();
  fireEvent.press(screen.getByLabelText('阳历月份：1 月'));
  fireEvent.press(screen.getByRole('button', { name: '2 月' }));
  expect(screen.getByLabelText('阳历日期：29 日')).toBeTruthy();
  expect(screen.getByText('2027.02.28')).toBeTruthy();
  expect(screen.getByText('今年没有 2 月 29 日，提前到 2 月 28 日提醒')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '保存修改' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      { name: '亲友a', lunar: null, solar: { month: 2, day: 29 } },
      'birthday',
    ),
  );
});

test('仅阳历记录补农历时不拿当前浏览日期当生日', () => {
  render(
    <BirthdayForm
      person={fixture('a', { lunar: null, solar: { month: 1, day: 11 } })}
      selectedDate={today}
      today={today}
      onSave={async () => {}}
      onCancel={() => {}}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: '两个都过' }));
  expect(screen.getByLabelText('农历月份：请选择')).toBeTruthy();
  expect(screen.getByText('请选择农历月日')).toBeTruthy();
});

test('同一个人的月历生日按本次发生类型标明阳历和农历，名称与类型分别显示', () => {
  const person = fixture('a', {
    name: '我的生日',
    lunar: { month: 12, day: 9, isLeap: false },
    solar: { month: 1, day: 11 },
  });
  const select = jest.fn();
  render(
    <MonthCalendar
      month="2027-01-01"
      today={today}
      selected="2027-01-11"
      entries={entriesForMonth(lunarCalendar, [person], '2027-01-01')}
      onSelect={select}
      onMonth={() => {}}
      onToday={() => {}}
    />,
  );
  const solar = screen.getByRole('button', { name: /2027-01-11.*阳历生日/ });
  const lunar = screen.getByRole('button', { name: /2027-01-16.*农历生日/ });
  expect(within(solar).getByText('我的生日').props.ellipsizeMode).toBe('tail');
  expect(within(solar).getByText('阳历')).toHaveStyle({ color: '#FFF', fontSize: 10 });
  expect(within(solar).getByTestId('birthday-cake')).toHaveStyle({ color: '#FFE2AF' });
  expect(within(lunar).getByTestId('birthday-cake')).toHaveStyle({ color: '#B8523E' });
  expect(within(solar).queryByText('农历')).toBeNull();
  expect(within(lunar).getByText('我的生日')).toBeTruthy();
  expect(within(lunar).getByText('农历')).toBeTruthy();
  expect(within(lunar).queryByText('阳历')).toBeNull();
  fireEvent.press(lunar);
  expect(select).toHaveBeenCalledWith('2027-01-16');
});

test('多人生日的类型标记属于当前展示的首个人，保留额外人数', () => {
  const people = [fixture('a', { lunar: null, solar: { month: 9, day: 4 } }), fixture('b')];
  render(
    <MonthCalendar
      month="2026-09-01"
      today={today}
      selected={today}
      entries={entriesForMonth(lunarCalendar, people, today)}
      onSelect={() => {}}
      onMonth={() => {}}
      onToday={() => {}}
    />,
  );
  const day = screen.getByRole('button', { name: /2026-09-04.*2 位生日/ });
  expect(within(day).getByText('亲友a的生日 +1')).toBeTruthy();
  expect(within(day).getByText('阳历')).toBeTruthy();
  expect(within(day).queryByText('农历')).toBeNull();
});

test('双生日同一天在提醒、月历和事项中只算一人，生日簿保留两套日期', async () => {
  render(
    <AppProvider repo={memoryRepository([fixture('a', { solar: { month: 9, day: 4 } })])} clock={clock}>
      <Home />
    </AppProvider>,
  );
  await screen.findByText('今天有 1 位亲友过生日');
  const day = screen.getByRole('button', { name: /2026-09-04.*1 位生日.*农历与阳历生日/ });
  expect(within(day).queryByText(/\+1/)).toBeNull();
  expect(within(day).getAllByTestId('birthday-cake')).toHaveLength(1);
  expect(within(day).getByText('农历')).toBeTruthy();
  expect(within(day).getByText('阳历')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: '查看亲友a的生日详情' })).toHaveLength(1);
  expect(screen.getByText('农历与阳历生日 · 同一天')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: '生日簿 1' }));
  const row = screen.getByRole('button', { name: '查看亲友a的生日' });
  expect(within(row).getByText('农历七月廿三 · 阳历9月4日')).toBeTruthy();
});

test('双生日详情按时间展示每次类型，删除整个人之前可取消', async () => {
  const repo = memoryRepository([fixture('a', { solar: { month: 9, day: 4 } })]);
  render(
    <AppProvider repo={repo} clock={clock}>
      <BirthdayDetails />
    </AppProvider>,
  );
  await screen.findByText('两个生日分别提醒，同一天重合时只提醒一次');
  expect(screen.getByText('农历与阳历生日 · 同一天 · 下次')).toBeTruthy();
  expect(screen.getAllByText('2026.09.04')).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: '删除生日' }));
  expect(screen.getByText('删除后，这个人的农历和阳历生日都将从日历、生日簿和当天提醒中移除。')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '取消' }));
  expect(repo.remove).not.toHaveBeenCalled();
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
test('首页提供独立日期计算入口，查询不会创建生日或时光记', async () => {
  const repo = memoryRepository();
  render(
    <AppProvider repo={repo} clock={clock}>
      <Home />
    </AppProvider>,
  );
  await screen.findByRole('button', { name: '日期计算' });
  fireEvent.press(screen.getByRole('button', { name: '日期计算' }));
  enterCalculatorDate('2020', '1', '1');
  expect(screen.getByText('已经过去 2438 天')).toBeTruthy();
  expect(repo.create).not.toHaveBeenCalled();
  expect(repo.createCountup).not.toHaveBeenCalled();
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

test('首页按标签直接展示对应内容，时光记不再跨标签预览或重复', async () => {
  const repo = memoryRepository(
    [fixture('person', { name: '妈妈' })],
    [countupFixture('a', { title: '开始健身', startDate: '2026-09-04', note: '每天半小时' })],
  );
  const home = render(
    <AppProvider repo={repo} clock={clock}>
      <Home />
    </AppProvider>,
  );
  await screen.findByRole('header', { name: '我的日历' });
  expect(screen.queryByRole('button', { name: '查看时光记开始健身' })).toBeNull();
  expect(screen.queryByRole('button', { name: '查看时光记开始健身，第 1 天' })).toBeNull();

  fireEvent.press(screen.getByRole('tab', { name: '生日簿 1' }));
  expect(screen.getByRole('header', { name: '生日簿' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '查看妈妈的生日' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '日期计算' })).toBeNull();
  expect(screen.queryByText('今天有 1 位亲友过生日')).toBeNull();

  fireEvent.press(screen.getByRole('tab', { name: '时光记 1' }));
  expect(screen.getByRole('header', { name: '时光记' })).toBeTruthy();
  expect(screen.getByText('每天半小时')).toBeTruthy();
  expect(screen.getAllByText('开始健身')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /查看全部.*时光记/ })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: '查看时光记开始健身，第 1 天' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/countup/[id]', params: { id: 'a' } });
  home.unmount();

  render(
    <AppProvider repo={repo} clock={clock}>
      <CountupDetails />
    </AppProvider>,
  );
  await screen.findByRole('button', { name: '编辑时光记' });
  expect(screen.getByText('开始日期 · 2026.09.04')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '删除时光记' }));
  expect(screen.getByText('删除后，这条时光记将不再显示。')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '取消' }));
  expect(repo.removeCountup).not.toHaveBeenCalled();
});

test('时光记标签直接展示全部记录', async () => {
  const repo = memoryRepository(
    [],
    [
      countupFixture('a', { title: '最早的记录', createdAt: '2026-01-01T00:00:00Z' }),
      countupFixture('b', { title: '第二条记录', createdAt: '2026-02-01T00:00:00Z' }),
      countupFixture('c', { title: '第三条记录', createdAt: '2026-03-01T00:00:00Z' }),
      countupFixture('d', { title: '最新的记录', createdAt: '2026-04-01T00:00:00Z' }),
    ],
  );
  render(
    <AppProvider repo={repo} clock={clock}>
      <Home />
    </AppProvider>,
  );
  await screen.findByRole('tab', { name: '时光记 4' });
  fireEvent.press(screen.getByRole('tab', { name: '时光记 4' }));
  expect(screen.getByRole('tab', { name: '时光记 4' }).props.accessibilityState).toEqual({
    selected: true,
  });
  expect(screen.getByRole('button', { name: '查看时光记最新的记录，第 1 天' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '查看时光记第三条记录，第 1 天' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '查看时光记第二条记录，第 1 天' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '查看时光记最早的记录，第 1 天' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /查看全部.*时光记/ })).toBeNull();
});

test('每年纪念详情同时展示周年、下一次纪念日和总天数', async () => {
  const repo = memoryRepository(
    [],
    [countupFixture('a', { title: '我们在一起', startDate: '2025-09-04', displayMode: 'anniversary' })],
  );
  render(
    <AppProvider repo={repo} clock={clock}>
      <CountupDetails />
    </AppProvider>,
  );
  expect(await screen.findByText('1 周年')).toBeTruthy();
  expect(screen.getByText('下一次 · 2027.09.04 · 365 天后')).toBeTruthy();
  expect(screen.getByText('从开始至今 · 第 366 天')).toBeTruthy();
});
