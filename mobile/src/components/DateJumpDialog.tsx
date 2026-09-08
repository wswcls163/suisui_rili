import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { dateInMonth, FIRST_DATE, LAST_DATE, monthEnd, supported } from '../core/dates';
import { Button, colors, common, Dialog } from './ui';

const ROW_HEIGHT = 44;

function DateWheel({
  label,
  unit,
  min,
  max,
  value,
  visibleRows,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  visibleRows: number;
  onChange: (value: number) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const current = useRef(value);
  const offset = useRef((value - min) * ROW_HEIGHT);
  const [initialOffset] = useState(() => ({ x: 0, y: (value - min) * ROW_HEIGHT }));
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const padding = ((visibleRows - 1) / 2) * ROW_HEIGHT;
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const align = () => {
    clearTimeout(timer.current);
    offset.current = (current.current - min) * ROW_HEIGHT;
    scroll.current?.scrollTo({ y: offset.current, animated: false });
  };
  useEffect(() => {
    // A dependent column (e.g. February's day limit) may change the value externally.
    if (current.current !== value) {
      clearTimeout(timer.current);
      current.current = value;
      offset.current = (value - min) * ROW_HEIGHT;
      scroll.current?.scrollTo({ y: offset.current, animated: false });
    }
  }, [value, min]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (next: number) => {
    clearTimeout(timer.current);
    next = clamp(next);
    current.current = next;
    offset.current = (next - min) * ROW_HEIGHT;
    scroll.current?.scrollTo({ y: offset.current, animated: false });
    onChange(next);
  };
  const settle = () => {
    clearTimeout(timer.current);
    const next = clamp(min + Math.round(offset.current / ROW_HEIGHT));
    scroll.current?.scrollTo({ y: (next - min) * ROW_HEIGHT, animated: false });
  };
  const scheduleSettle = () => {
    clearTimeout(timer.current);
    if (!dragging.current) timer.current = setTimeout(settle, 120);
  };
  return (
    <View style={styles.column}>
      <Text style={styles.unit}>{unit}</Text>
      <View style={{ height: visibleRows * ROW_HEIGHT }}>
        <View pointerEvents="none" style={[styles.selection, { top: padding }]} />
        <ScrollView
          ref={scroll}
          accessibilityLabel={label}
          accessibilityRole="adjustable"
          accessibilityValue={{ min, max, now: value, text: `${value} ${unit}` }}
          {...(Platform.OS === 'web'
            ? {
                tabIndex: 0 as const,
                'aria-valuemin': min,
                'aria-valuemax': max,
                'aria-valuenow': value,
                'aria-valuetext': `${value} ${unit}`,
                onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                  const targets: Record<string, number> = {
                    ArrowUp: value - 1,
                    ArrowDown: value + 1,
                    PageUp: value - 10,
                    PageDown: value + 10,
                    Home: min,
                    End: max,
                  };
                  if (event.key in targets) {
                    event.preventDefault();
                    choose(targets[event.key]);
                  }
                },
              }
            : {})}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'increment') choose(value + 1);
            if (nativeEvent.actionName === 'decrement') choose(value - 1);
          }}
          contentContainerStyle={{ paddingVertical: padding }}
          contentOffset={initialOffset}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onLayout={align}
          onContentSizeChange={align}
          onScroll={({ nativeEvent }) => {
            offset.current = nativeEvent.contentOffset.y;
            const next = clamp(min + Math.round(offset.current / ROW_HEIGHT));
            if (next !== current.current) {
              current.current = next;
              onChange(next);
            }
            scheduleSettle();
          }}
          onScrollBeginDrag={() => {
            dragging.current = true;
            clearTimeout(timer.current);
          }}
          onScrollEndDrag={() => {
            dragging.current = false;
            scheduleSettle();
          }}
          onMomentumScrollBegin={() => {
            dragging.current = true;
            clearTimeout(timer.current);
          }}
          onMomentumScrollEnd={() => {
            dragging.current = false;
            settle();
          }}
        >
          {Array.from({ length: max - min + 1 }, (_, index) => {
            const item = min + index;
            const distance = Math.abs(item - value);
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`${item} ${unit}`}
                accessibilityState={{ selected: item === value }}
                onPress={() => choose(item)}
                style={styles.item}
              >
                <Text
                  style={[
                    styles.number,
                    { opacity: distance === 0 ? 1 : distance === 1 ? 0.65 : 0.35 },
                    item === value && styles.activeNumber,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function DateJumpDialog({
  initialDate,
  title = '跳转日期',
  confirmLabel = '跳转',
  onConfirm,
  onClose,
}: {
  initialDate: string;
  title?: string;
  confirmLabel?: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [input, setInput] = useState(initialDate);
  const dateRef = useRef(initialDate);
  const [year, month, day] = date.split('-').map(Number);
  const { height } = useWindowDimensions();
  const visibleRows = height < 700 ? 3 : 5;
  const inputValid = supported(input);
  const applyDate = (next: string) => {
    dateRef.current = next;
    setDate(next);
    setInput(next);
  };
  const changePart = (part: 0 | 1 | 2, next: number) => {
    // Wheels may emit in the same render batch; always retain the latest other columns.
    const parts = dateRef.current.split('-');
    parts[part] = String(next).padStart(2, '0');
    applyDate(dateInMonth(parts.join('-'), `${parts[0]}-${parts[1]}-01`));
  };
  return (
    <Dialog visible title={title} onClose={onClose}>
      <Text style={common.muted}>
        直接输入 8 位日期，或{Platform.OS === 'web' ? '滚动鼠标滚轮、点选年月日' : '上下滑动、点选年月日'}
      </Text>
      <View style={styles.inputGroup}>
        <TextInput
          accessibilityLabel="直接输入日期"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, '').slice(0, 8);
            const formatted =
              digits.length <= 4
                ? digits
                : digits.length <= 6
                  ? `${digits.slice(0, 4)}-${digits.slice(4)}`
                  : `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
            if (supported(formatted)) applyDate(formatted);
            else setInput(formatted);
          }}
          placeholder="例如：20200928"
          placeholderTextColor="#A0A5A1"
          selectTextOnFocus
          style={common.input}
          value={input}
        />
        <Text style={input.length === 10 && !inputValid ? common.error : common.muted}>
          {input.length === 10 && !inputValid ? '请输入 1901—2100 年内的有效日期' : '格式：YYYY-MM-DD · 阳历'}
        </Text>
      </View>
      <View style={styles.wheels}>
        <DateWheel
          label="年份"
          unit="年"
          min={Number(FIRST_DATE.slice(0, 4))}
          max={Number(LAST_DATE.slice(0, 4))}
          value={year}
          visibleRows={visibleRows}
          onChange={(next) => changePart(0, next)}
        />
        <DateWheel
          label="月份"
          unit="月"
          min={1}
          max={12}
          value={month}
          visibleRows={visibleRows}
          onChange={(next) => changePart(1, next)}
        />
        <DateWheel
          label="日期"
          unit="日"
          min={1}
          max={Number(monthEnd(date).slice(8))}
          value={day}
          visibleRows={visibleRows}
          onChange={(next) => changePart(2, next)}
        />
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.preview}>
        {year} 年 {month} 月 {day} 日
      </Text>
      <View style={styles.actions}>
        <Button label="取消" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button
          label={confirmLabel}
          disabled={!inputValid}
          onPress={() => onConfirm(input)}
          style={{ flex: 1 }}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  inputGroup: { gap: 7, marginTop: 16 },
  wheels: { flexDirection: 'row', gap: 10, marginTop: 16 },
  column: { flex: 1, minWidth: 0 },
  unit: { ...common.muted, textAlign: 'center', marginBottom: 8 },
  item: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 18, color: colors.ink, fontVariant: ['tabular-nums'] },
  activeNumber: { color: colors.accent, fontWeight: '600' },
  selection: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    borderRadius: 10,
    backgroundColor: colors.tint,
    borderColor: '#E9CBBF',
    borderWidth: 1,
  },
  preview: { ...common.body, textAlign: 'center', marginVertical: 18 },
  actions: { flexDirection: 'row', gap: 12 },
});
