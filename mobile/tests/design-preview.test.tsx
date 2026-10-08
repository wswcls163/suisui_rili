import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DesignPreviewHome } from '../src/components/design-preview/DesignPreviewHome';

describe('独立首页视觉预览', () => {
  test('以成熟应用骨架呈现日历、近期事项和固定主导航', () => {
    render(<DesignPreviewHome today="2026-10-08" />);

    expect(screen.getByRole('header', { name: '岁岁日历' })).toBeTruthy();
    expect(screen.getByRole('header', { name: '2026年10月' })).toBeTruthy();
    expect(screen.getByText('10月8日 星期四')).toBeTruthy();
    expect(screen.getAllByText('妈妈的生日')).toHaveLength(2);
    expect(screen.getAllByLabelText('妈妈的生日头像')).toHaveLength(2);
    expect(screen.getByLabelText('一起旅行纪念缩略图')).toBeTruthy();
    expect(screen.getByLabelText('日历').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });
    expect(screen.getByLabelText('生日簿').props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    });
    expect(screen.queryByText('照片')).toBeNull();
    expect(screen.queryByText(/独立视觉预览/)).toBeNull();
    expect(screen.queryByText(/留一点空白/)).toBeNull();
    expect(screen.queryByText(/同步状态/)).toBeNull();
    expect(screen.queryByText(/通知诊断/)).toBeNull();
  });

  test('支持切换月份、选择重要日子和回到今天', () => {
    render(<DesignPreviewHome today="2026-10-08" />);

    fireEvent.press(screen.getByRole('button', { name: '上一个月' }));
    expect(screen.getByRole('header', { name: '2026年9月' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: '妈妈的生日，10月12日，4天后' }));
    expect(screen.getByRole('header', { name: '10月12日' })).toBeTruthy();
    expect(screen.getAllByText('阳历生日 · 已开启提醒')).toHaveLength(2);

    fireEvent.press(screen.getByRole('button', { name: '回到今天' }));
    expect(screen.getByRole('header', { name: '10月8日' })).toBeTruthy();
    expect(screen.getByText('节日与节气')).toBeTruthy();
  });
});
