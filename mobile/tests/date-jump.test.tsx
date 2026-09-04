import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DateJumpDialog } from '../src/components/DateJumpDialog';

function mount(date: string) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const result = render(<DateJumpDialog initialDate={date} onConfirm={onConfirm} onClose={onClose} />);
  return { ...result, onConfirm, onClose };
}
const pick = (label: string) => fireEvent.press(screen.getByRole('button', { name: label }));

test('三列预选完整日期，直接确认不改变日，不需要键盘输入', () => {
  const { onConfirm } = mount('2026-09-18');
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByLabelText('年份').props.accessibilityValue.now).toBe(2026);
  expect(screen.getByLabelText('月份').props.accessibilityValue.now).toBe(9);
  expect(screen.getByLabelText('日期').props.accessibilityValue.now).toBe(18);
  pick('跳转');
  expect(onConfirm).toHaveBeenCalledWith('2026-09-18');
});

test.each([
  ['2024-01-31', '2 月', '2024-02-29'],
  ['2025-01-31', '2 月', '2025-02-28'],
  ['2026-03-31', '4 月', '2026-04-30'],
  ['2024-02-29', '2025 年', '2025-02-28'],
  ['2000-01-31', '2 月', '2000-02-29'],
  ['2100-01-31', '2 月', '2100-02-28'],
])('%s 切换 %s 时收敛到合法日期 %s', (initial, choice, expected) => {
  const { onConfirm } = mount(initial);
  pick(choice);
  expect(screen.getByLabelText('日期').props.accessibilityValue.now).toBe(Number(expected.slice(8)));
  expect(screen.queryByRole('button', { name: '31 日' })).toBeNull();
  pick('跳转');
  expect(onConfirm).toHaveBeenCalledWith(expected);
});

test('小月换回大月后可以选择三十一日，跨年可选到十二月最后一天', () => {
  const { onConfirm } = mount('2025-02-28');
  pick('2026 年');
  pick('12 月');
  pick('31 日');
  pick('跳转');
  expect(onConfirm).toHaveBeenCalledWith('2026-12-31');
});

test.each(['1901-01-01', '2100-12-31'])('支持边界 %s，滚轮越界和无障碍步进也不会产生非法年份', (date) => {
  const { onConfirm } = mount(date);
  const first = date.startsWith('1901');
  fireEvent.scroll(screen.getByLabelText('年份'), {
    nativeEvent: { contentOffset: { y: first ? -200 : 100000 } },
  });
  fireEvent(screen.getByLabelText('年份'), 'accessibilityAction', {
    nativeEvent: { actionName: first ? 'decrement' : 'increment' },
  });
  expect(screen.queryByRole('button', { name: '1900 年' })).toBeNull();
  expect(screen.queryByRole('button', { name: '2101 年' })).toBeNull();
  pick('跳转');
  expect(onConfirm).toHaveBeenCalledWith(date);
});

test('滚轮选择最近一项，立即确认使用当前日期；关闭后清理待吸附计时器', () => {
  jest.useFakeTimers();
  try {
    const { onConfirm, unmount } = mount('2026-09-18');
    fireEvent.scroll(screen.getByLabelText('年份'), {
      nativeEvent: { contentOffset: { y: (2024 - 1901) * 44 + 10 } },
    });
    fireEvent.scroll(screen.getByLabelText('月份'), {
      nativeEvent: { contentOffset: { y: 44 } },
    });
    fireEvent.scroll(screen.getByLabelText('日期'), {
      nativeEvent: { contentOffset: { y: 28 * 44 } },
    });
    pick('跳转');
    expect(onConfirm).toHaveBeenCalledWith('2024-02-29');
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    act(() => jest.runOnlyPendingTimers());
  } finally {
    jest.useRealTimers();
  }
});

test('取消只关闭弹窗，不提交草稿日期', () => {
  const { onClose, onConfirm } = mount('2026-09-18');
  pick('2024 年');
  pick('取消');
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('三列在同一批次内连续选择时互不覆盖，旧日期事件也不能越过新月份的月末', () => {
  const { onConfirm } = mount('2024-01-31');
  const year = screen.getByRole('button', { name: '2026 年' });
  const month = screen.getByRole('button', { name: '2 月' });
  const day = screen.getByRole('button', { name: '31 日' });
  act(() => {
    fireEvent.press(year);
    fireEvent.press(month);
    fireEvent.press(day);
  });
  pick('跳转');
  expect(onConfirm).toHaveBeenCalledWith('2026-02-28');
});

test('电脑滚轮支持方向键、十年快选和首尾键，并向读屏提供当前值', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  try {
    const { onConfirm } = mount('2026-09-18');
    const key = (value: string) =>
      fireEvent(screen.getByLabelText('年份'), 'keyDown', { key: value, preventDefault: jest.fn() });
    key('ArrowUp');
    expect(screen.getByLabelText('年份').props['aria-valuenow']).toBe(2025);
    key('PageUp');
    expect(screen.getByLabelText('年份').props['aria-valuenow']).toBe(2015);
    key('Home');
    expect(screen.getByLabelText('年份').props['aria-valuenow']).toBe(1901);
    key('ArrowUp');
    expect(screen.getByLabelText('年份').props['aria-valuenow']).toBe(1901);
    key('End');
    expect(screen.getByLabelText('年份').props['aria-valuetext']).toBe('2100 年');
    pick('跳转');
    expect(onConfirm).toHaveBeenCalledWith('2100-09-18');
  } finally {
    platform.restore();
  }
});
