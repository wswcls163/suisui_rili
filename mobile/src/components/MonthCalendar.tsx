import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { birthdayTitle, occurrenceLabel, type BirthdayEntry } from '../core/birthday';
import { DAY_NAMES, MONTH_NAMES, lunarCalendar, lunarLabel } from '../core/calendar';
import { type Countup } from '../core/countup';
import { festivalsOn } from '../core/festivals';
import { monthGrid, shiftMonth, supported } from '../core/dates';
import { DateJumpDialog } from './DateJumpDialog';
import { memoryItemsOn } from './home/homeEvents';
import { defaultHomeTheme, type HomeTheme } from './home/homeTheme';
import { Icon } from './ui';

export function MonthCalendar({
  month,
  today,
  selected,
  entries,
  countups = [],
  onSelect,
  onMonth,
  onToday,
  showTodayAction = true,
  theme = defaultHomeTheme,
}: {
  month: string;
  today: string;
  selected: string;
  entries: BirthdayEntry[];
  countups?: Countup[];
  onSelect: (date: string) => void;
  onMonth: (month: string) => void;
  onToday: () => void;
  compact?: boolean;
  showTodayAction?: boolean;
  theme?: HomeTheme;
}) {
  const [jump, setJump] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const grid = useMemo(() => monthGrid(month), [month]);
  const byDate = useMemo(() => {
    const result = new Map<string, BirthdayEntry[]>();
    for (const entry of entries)
      result.set(entry.occurrence.solar, [...(result.get(entry.occurrence.solar) ?? []), entry]);
    return result;
  }, [entries]);

  return (
    <View testID="完整月历" style={styles.calendar}>
      <View testID="month-calendar-header" style={styles.calendarHeader}>
        <Pressable
          testID="month-calendar-title"
          accessibilityRole="button"
          accessibilityLabel="跳转日期"
          onPress={() => setJump(true)}
          style={styles.calendarTitle}
        >
          <Text accessibilityRole="header" style={styles.calendarTitleText}>
            {Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月
          </Text>
          <Icon name="chevron-down" size={16} color={theme.colors.textSecondary} />
        </Pressable>
        <View testID="month-calendar-actions" style={styles.calendarActions}>
          {showTodayAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="回到今天"
              accessibilityState={{ disabled: !supported(today) }}
              disabled={!supported(today)}
              onPress={onToday}
              style={({ pressed }) => [styles.todayAction, pressed && styles.pressed]}
            >
              <Text style={styles.todayActionText}>今天</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上个月"
            accessibilityState={{ disabled: !supported(shiftMonth(month, -1)) }}
            disabled={!supported(shiftMonth(month, -1))}
            onPress={() => onMonth(shiftMonth(month, -1))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Icon name="chevron-back" color={theme.colors.textPrimary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="下个月"
            accessibilityState={{ disabled: !supported(shiftMonth(month, 1)) }}
            disabled={!supported(shiftMonth(month, 1))}
            onPress={() => onMonth(shiftMonth(month, 1))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Icon name="chevron-forward" color={theme.colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.week}>
        {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => (
          <Text key={day} style={[styles.weekday, (index === 0 || index === 6) && styles.weekend]}>
            {day}
          </Text>
        ))}
      </View>

      {grid.map((week, weekIndex) => (
        <View key={`${month}-${weekIndex}`} style={styles.week}>
          {week.map((date, dayIndex) => {
            if (!date) return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.cell} />;
            const lunar = lunarCalendar.lunarOn(date);
            const lunarText =
              lunar.day === 1
                ? `${lunar.isLeap ? '闰' : ''}${MONTH_NAMES[lunar.month - 1]}`
                : DAY_NAMES[lunar.day - 1];
            const birthdays = byDate.get(date) ?? [];
            const festivals = festivalsOn(date);
            const memories = memoryItemsOn(date, countups);
            const dayLabel = festivals[0] ?? lunarText;
            const isSelected = date === selected;
            const isToday = date === today;
            const description = `${date}，农历${lunarLabel(lunar)}${
              festivals.length ? `，${festivals.join('、')}` : ''
            }${
              birthdays.length
                ? `，${birthdays.length} 位生日：${birthdays
                    .map(
                      (entry) =>
                        birthdayTitle(entry.person.name) +
                        (entry.person.solar ? `（${occurrenceLabel(entry.occurrence)}）` : ''),
                    )
                    .join('、')}`
                : ''
            }${memories.length ? `，${memories.length} 条时光记：${memories.map((item) => item.title).join('、')}` : ''}`;

            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={description}
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(date)}
                style={({ pressed }) => [styles.cell, styles.day, pressed && styles.pressed]}
              >
                <View
                  testID={isSelected ? '选中日期' : undefined}
                  style={[
                    styles.dayNumberWrap,
                    isToday && !isSelected && styles.todayRing,
                    isSelected && styles.selectedDay,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      isToday && !isSelected && styles.todayNumber,
                      isSelected && styles.selectedDayText,
                    ]}
                  >
                    {Number(date.slice(8))}
                  </Text>
                </View>
                <View style={styles.labelLine}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.lunar, festivals.length > 0 && styles.festivalText]}
                  >
                    {dayLabel}
                  </Text>
                  {festivals.length > 1 ? (
                    <Text style={styles.labelCount}>+{festivals.length - 1}</Text>
                  ) : null}
                </View>
                <View style={styles.markerRow}>
                  {festivals.length > 0 ? (
                    <View accessibilityLabel="有节日或节气" style={[styles.marker, styles.festivalMarker]} />
                  ) : null}
                  {birthdays.length > 0 ? (
                    <View
                      testID="birthday-marker"
                      accessibilityLabel="有生日"
                      style={[styles.marker, styles.birthdayMarker]}
                    />
                  ) : null}
                  {memories.length > 0 ? (
                    <View accessibilityLabel="有时光记" style={[styles.marker, styles.memoryMarker]} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.calendarFooter}>
        <View style={styles.legendItem}>
          <View style={[styles.marker, styles.festivalMarker]} />
          <Text style={styles.legendText}>节日</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.marker, styles.birthdayMarker]} />
          <Text style={styles.legendText}>生日</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.marker, styles.memoryMarker]} />
          <Text style={styles.legendText}>时光记</Text>
        </View>
      </View>

      {jump ? (
        <DateJumpDialog
          initialDate={selected}
          onClose={() => setJump(false)}
          onConfirm={(date) => {
            onSelect(date);
            setJump(false);
          }}
        />
      ) : null}
    </View>
  );
}

function createStyles(theme: HomeTheme) {
  const { colors, typography, spacing, radius, size } = theme;
  return StyleSheet.create({
    calendar: { backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
    calendarHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
      minHeight: 58,
      paddingLeft: spacing.xs,
    },
    calendarTitle: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: size.iconButton,
      minWidth: 0,
    },
    calendarTitleText: {
      color: colors.textPrimary,
      fontSize: typography.monthTitle,
      fontWeight: typography.bold,
      letterSpacing: -0.6,
    },
    calendarActions: { alignItems: 'center', flexDirection: 'row', flexShrink: 0 },
    arrow: {
      alignItems: 'center',
      height: size.iconButton,
      justifyContent: 'center',
      width: size.iconButton,
    },
    todayAction: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: size.iconButton,
      paddingHorizontal: spacing.xs,
    },
    todayActionText: {
      color: colors.accent,
      fontSize: typography.label,
      fontWeight: typography.semibold,
    },
    week: { flexDirection: 'row' },
    weekday: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: typography.caption,
      fontWeight: typography.semibold,
      paddingBottom: spacing.xs,
      textAlign: 'center',
    },
    weekend: { color: colors.accent },
    cell: {
      alignItems: 'center',
      borderRadius: radius.sm,
      flex: 1,
      height: size.dayCell,
      minWidth: 0,
      paddingTop: spacing.xxs,
    },
    day: { justifyContent: 'flex-start' },
    pressed: { backgroundColor: colors.pressed },
    dayNumberWrap: {
      alignItems: 'center',
      height: size.selectedDay,
      justifyContent: 'center',
      width: size.selectedDay,
    },
    todayRing: { borderColor: colors.today, borderRadius: radius.round, borderWidth: 1.5 },
    selectedDay: { backgroundColor: colors.selected, borderRadius: radius.round },
    dayNumber: {
      color: colors.textPrimary,
      fontSize: typography.dayNumber,
      fontWeight: typography.medium,
    },
    todayNumber: { color: colors.today, fontWeight: typography.bold },
    selectedDayText: { color: colors.selectedText, fontWeight: typography.bold },
    labelLine: { alignItems: 'center', flexDirection: 'row', gap: 1, maxWidth: '96%' },
    lunar: { color: colors.textSecondary, flexShrink: 1, fontSize: typography.caption },
    festivalText: { color: colors.festival, fontWeight: typography.semibold },
    labelCount: { color: colors.festival, fontSize: typography.tiny },
    markerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xxs,
      height: 6,
      justifyContent: 'center',
      marginTop: 1,
    },
    marker: { borderRadius: radius.round, height: 4, width: 4 },
    birthdayMarker: { backgroundColor: colors.birthday },
    festivalMarker: { backgroundColor: colors.festival },
    memoryMarker: { backgroundColor: colors.memory },
    calendarFooter: {
      flexDirection: 'row',
      gap: spacing.lg,
      justifyContent: 'center',
      minHeight: 30,
      paddingTop: spacing.xs,
    },
    legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
    legendText: { color: colors.textSecondary, fontSize: typography.caption },
  });
}
