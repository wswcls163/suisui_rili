import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DesignPreviewHome } from '../src/components/design-preview/DesignPreviewHome';

describe('独立首页视觉预览', () => {
  test('以日历为主体并使用不写入正式数据的示例内容', () => {
    render(<DesignPreviewHome today="2026-10-08" />);

    expect(screen.getByRole('header', { name: '今天' })).toBeTruthy();
    expect(screen.getByRole('header', { name: '2026年10月' })).toBeTruthy();
    expect(screen.getAllByText('妈妈的生日')).toHaveLength(2);
    expect(screen.getByText('独立视觉预览 · 使用示例内容，不会写入你的日历')).toBeTruthy();
    expect(screen.getAllByLabelText(/照片占位/)).toHaveLength(3);
    expect(screen.queryByText(/同步状态/)).toBeNull();
    expect(screen.queryByText(/通知诊断/)).toBeNull();
  });

  test('支持切换月份、选择重要日子和回到今天', () => {
    render(<DesignPreviewHome today="2026-10-08" />);

    fireEvent.press(screen.getByRole('button', { name: '上一个月' }));
    expect(screen.getByRole('header', { name: '2026年9月' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: /妈妈的生日，10月12日，4 天后/ }));
    expect(screen.getByRole('header', { name: '10月12日' })).toBeTruthy();
    expect(screen.getAllByText('准备一束她喜欢的花')).toHaveLength(2);

    fireEvent.press(screen.getByRole('button', { name: '回到今天' }));
    expect(screen.getByRole('header', { name: '10月8日' })).toBeTruthy();
    expect(screen.getByText('这一天没有额外记录，留一点空白也很好。')).toBeTruthy();
  });
});
