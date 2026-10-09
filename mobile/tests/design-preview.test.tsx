import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { DesignPreviewHome } from '../src/components/design-preview/DesignPreviewHome';
import { defaultDesignPreviewTheme } from '../src/components/design-preview/designPreviewTheme';

describe('独立首页视觉预览', () => {
  test('完整月历后紧接分组事项流，并保留固定导航和新增入口', () => {
    render(<DesignPreviewHome today="2026-10-08" />);

    expect(screen.getByRole('header', { name: '岁岁日历' })).toBeTruthy();
    expect(screen.getByRole('header', { name: '2026年10月' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^选择 10月/ })).toHaveLength(31);
    const calendarFlow = screen.getByTestId('月历事项一体区');
    expect(calendarFlow.props.children[0].props.testID).toBe('完整月历');
    expect(calendarFlow.props.children[1].props.testID).toBe('事项列表');
    expect(screen.getByText('今天 · 10月8日')).toBeTruthy();
    expect(screen.getByText('接下来')).toBeTruthy();
    expect(screen.getByRole('button', { name: '新增事项' })).toBeTruthy();
    expect(screen.getByLabelText('日历').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });
    expect(screen.getByLabelText('生日簿').props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    });
    expect(screen.queryByLabelText(/周历|折叠/)).toBeNull();
  });

  test('页面消费可替换主题 token，选中日期不依赖组件硬编码颜色', () => {
    const selected = '#123456';
    const theme = {
      ...defaultDesignPreviewTheme,
      colors: { ...defaultDesignPreviewTheme.colors, selected },
    };
    render(<DesignPreviewHome today="2026-10-08" theme={theme} />);

    expect(StyleSheet.flatten(screen.getByTestId('选中日期').props.style).backgroundColor).toBe(selected);
  });

  test('支持切换月份、选择重要日子和回到今天', () => {
    render(<DesignPreviewHome today="2026-10-08" />);

    fireEvent.press(screen.getByRole('button', { name: '上一个月' }));
    expect(screen.getByRole('header', { name: '2026年9月' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: '妈妈的生日，10月12日，4天后' }));
    expect(screen.getByText('10月12日 · 星期一')).toBeTruthy();
    expect(screen.getByText('阳历生日 · 全天')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: '回到今天' }));
    expect(screen.getByText('今天 · 10月8日')).toBeTruthy();
    expect(screen.getByText('节日与节气 · 全天')).toBeTruthy();
  });
});
