import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { lunarCalendar, lunarLabel } from '../../core/calendar';
import {
  addDays,
  chineseWeekday,
  dateInMonth,
  FIRST_DATE,
  LAST_DATE,
  monthGrid,
  monthStart,
  shiftMonth,
} from '../../core/dates';
import { festivalsOn } from '../../core/festivals';
import { defaultDesignPreviewTheme, type DesignPreviewTheme } from './designPreviewTheme';

type PreviewEventKind = 'birthday' | 'memory';
type TimelineKind = PreviewEventKind | 'festival';

type PreviewEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind: PreviewEventKind;
};

type DesignPreviewHomeProps = {
  today: string;
  theme?: DesignPreviewTheme;
};

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

const navItems: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'calendar', label: '日历', icon: 'calendar-outline' },
  { key: 'birthdays', label: '生日簿', icon: 'gift-outline' },
  { key: 'memories', label: '时光记', icon: 'sparkles-outline' },
  { key: 'profile', label: '我的', icon: 'person-outline' },
];

function monthTitle(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return `${year}年${month}月`;
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日`;
}

function relativeLabel(date: string, today: string): string {
  const distance = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (distance === 0) return '今天';
  if (distance === 1) return '明天';
  if (distance > 1) return `${distance}天后`;
  return `${Math.abs(distance)}天前`;
}

function createPreviewEvents(today: string): PreviewEvent[] {
  return [
    {
      id: 'mother-birthday',
      date: addDays(today, 4),
      title: '妈妈的生日',
      detail: '阳历生日 · 全天',
      kind: 'birthday',
    },
    {
      id: 'travel-memory',
      date: addDays(today, 10),
      title: '一起旅行纪念',
      detail: '每年纪念 · 第 3 年',
      kind: 'memory',
    },
    {
      id: 'friend-birthday',
      date: addDays(today, 17),
      title: '阿宁的生日',
      detail: '农历生日 · 全天',
      kind: 'birthday',
    },
  ];
}

function markerStyle(kind: TimelineKind, styles: ReturnType<typeof createStyles>) {
  if (kind === 'birthday') return styles.birthdayMarker;
  if (kind === 'festival') return styles.festivalMarker;
  return styles.memoryMarker;
}

function iconWrapStyle(kind: TimelineKind, styles: ReturnType<typeof createStyles>) {
  if (kind === 'birthday') return styles.birthdayIconWrap;
  if (kind === 'festival') return styles.festivalIconWrap;
  return styles.memoryIconWrap;
}

function iconFor(kind: TimelineKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'birthday') return 'gift-outline';
  if (kind === 'festival') return 'flag-outline';
  return 'sparkles-outline';
}

function colorFor(kind: TimelineKind, theme: DesignPreviewTheme): string {
  if (kind === 'birthday') return theme.colors.birthday;
  if (kind === 'festival') return theme.colors.festival;
  return theme.colors.memory;
}

function PreviewDay({
  date,
  today,
  selected,
  event,
  onPress,
  styles,
}: {
  date: string | null;
  today: string;
  selected: boolean;
  event?: PreviewEvent;
  onPress: (date: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!date) return <View style={styles.dayCell} />;
  const day = Number(date.slice(8));
  const lunar = lunarCalendar.lunarOn(date);
  const festivals = festivalsOn(date);
  const helper = festivals[0] ?? lunarLabel(lunar);
  const isToday = date === today;
  const description = [
    `${Number(date.slice(5, 7))}月${day}日`,
    isToday ? '今天' : '',
    festivals.join('、'),
    event?.title ?? '',
    `农历${lunarLabel(lunar)}`,
  ]
    .filter(Boolean)
    .join('，');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`选择 ${description}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(date)}
      style={({ pressed }) => [styles.dayCell, pressed && styles.dayCellPressed]}
    >
      <View
        testID={selected ? '选中日期' : undefined}
        style={[
          styles.dayNumberWrap,
          isToday && !selected && styles.todayRing,
          selected && styles.selectedDay,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            isToday && !selected && styles.todayNumber,
            selected && styles.selectedDayText,
          ]}
        >
          {day}
        </Text>
      </View>
      <Text numberOfLines={1} style={[styles.dayHelper, festivals.length > 0 && styles.festivalHelper]}>
        {helper}
      </Text>
      <View style={styles.markerRow}>
        {festivals.length > 0 ? (
          <View accessibilityLabel="有节日或节气" style={[styles.eventMarker, styles.festivalMarker]} />
        ) : null}
        {event ? (
          <View
            accessibilityLabel={event.kind === 'birthday' ? '有生日' : '有时光记'}
            style={[styles.eventMarker, markerStyle(event.kind, styles)]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function TimelineRow({
  kind,
  title,
  detail,
  trailingTop,
  trailingBottom,
  onPress,
  theme,
  styles,
}: {
  kind: TimelineKind;
  title: string;
  detail: string;
  trailingTop: string;
  trailingBottom?: string;
  onPress?: () => void;
  theme: DesignPreviewTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${title}，${trailingTop}，${trailingBottom ?? detail}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.timelineRow, pressed && styles.rowPressed]}
    >
      <View style={[styles.timelineRail, markerStyle(kind, styles)]} />
      <View style={[styles.eventIconWrap, iconWrapStyle(kind, styles)]}>
        <Ionicons name={iconFor(kind)} size={18} color={colorFor(kind, theme)} accessible={false} />
      </View>
      <View style={styles.timelineCopy}>
        <Text numberOfLines={1} style={styles.timelineTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.timelineDetail}>
          {detail}
        </Text>
      </View>
      <View style={styles.timelineTrailing}>
        <Text style={styles.timelineDate}>{trailingTop}</Text>
        {trailingBottom ? (
          <Text style={[styles.timelineRelative, { color: colorFor(kind, theme) }]}>{trailingBottom}</Text>
        ) : null}
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} accessible={false} />
      ) : null}
    </Pressable>
  );
}

function BottomNavigation({
  theme,
  styles,
}: {
  theme: DesignPreviewTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.bottomNavigation}>
      {navItems.map((item) => {
        const selected = item.key === 'calendar';
        return (
          <View
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected, disabled: !selected }}
            style={styles.navItem}
          >
            <Ionicons
              name={selected ? 'calendar' : item.icon}
              size={21}
              color={selected ? theme.colors.accent : theme.colors.navInactive}
              accessible={false}
            />
            <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function DesignPreviewHome({ today, theme = defaultDesignPreviewTheme }: DesignPreviewHomeProps) {
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const desktopFrame = Platform.OS === 'web' && width >= 700;
  const [visibleMonth, setVisibleMonth] = useState(monthStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const events = useMemo(() => createPreviewEvents(today), [today]);
  const eventByDate = useMemo(() => new Map(events.map((event) => [event.date, event])), [events]);
  const selectedEvents = events.filter((event) => event.date === selectedDate);
  const upcomingEvents = events.filter((event) => event.date > selectedDate).slice(0, 3);
  const selectedFestivals = festivalsOn(selectedDate);
  const selectedLunar = lunarLabel(lunarCalendar.lunarOn(selectedDate));
  const grid = monthGrid(visibleMonth);
  const canGoPrevious = visibleMonth > monthStart(FIRST_DATE);
  const canGoNext = visibleMonth < monthStart(LAST_DATE);

  function selectDate(date: string) {
    setSelectedDate(date);
    if (monthStart(date) !== visibleMonth) setVisibleMonth(monthStart(date));
  }

  function changeMonth(delta: number) {
    const nextMonth = shiftMonth(visibleMonth, delta);
    setVisibleMonth(nextMonth);
    setSelectedDate((current) => dateInMonth(current, nextMonth));
  }

  function returnToday() {
    setVisibleMonth(monthStart(today));
    setSelectedDate(today);
  }

  const selectedHeading =
    selectedDate === today
      ? `今天 · ${shortDate(selectedDate)}`
      : `${shortDate(selectedDate)} · ${chineseWeekday(selectedDate)}`;

  return (
    <View style={[styles.stage, desktopFrame && styles.desktopStage]}>
      <View style={[styles.phone, desktopFrame && styles.desktopPhone]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.appBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Ionicons name="calendar" size={18} color={theme.colors.accent} accessible={false} />
              </View>
              <Text accessibilityRole="header" style={styles.brandName}>
                岁岁日历
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="回到今天"
              onPress={returnToday}
              style={({ pressed }) => [styles.todayAction, pressed && styles.rowPressed]}
            >
              <Ionicons name="locate-outline" size={17} color={theme.colors.accent} accessible={false} />
              <Text style={styles.todayActionText}>今天</Text>
            </Pressable>
          </View>

          <View testID="月历事项一体区">
            <View testID="完整月历" style={styles.calendarSection}>
              <View style={styles.monthToolbar}>
                <Text accessibilityRole="header" style={styles.monthTitle}>
                  {monthTitle(visibleMonth)}
                </Text>
                <View style={styles.monthActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="上一个月"
                    accessibilityState={{ disabled: !canGoPrevious }}
                    disabled={!canGoPrevious}
                    onPress={() => changeMonth(-1)}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.rowPressed]}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={21}
                      color={theme.colors.textPrimary}
                      accessible={false}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="下一个月"
                    accessibilityState={{ disabled: !canGoNext }}
                    disabled={!canGoNext}
                    onPress={() => changeMonth(1)}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.rowPressed]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={21}
                      color={theme.colors.textPrimary}
                      accessible={false}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.weekRow}>
                {weekdayLabels.map((label, index) => (
                  <Text key={label} style={[styles.weekday, (index === 0 || index === 6) && styles.weekend]}>
                    {label}
                  </Text>
                ))}
              </View>

              {grid.map((week, weekIndex) => (
                <View key={`${visibleMonth}-${weekIndex}`} style={styles.weekRow}>
                  {week.map((date, dayIndex) => (
                    <PreviewDay
                      key={date ?? `${weekIndex}-${dayIndex}`}
                      date={date}
                      today={today}
                      selected={date === selectedDate}
                      event={date ? eventByDate.get(date) : undefined}
                      onPress={selectDate}
                      styles={styles}
                    />
                  ))}
                </View>
              ))}

              <View style={styles.calendarLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.eventMarker, styles.festivalMarker]} />
                  <Text style={styles.legendText}>节日</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.eventMarker, styles.birthdayMarker]} />
                  <Text style={styles.legendText}>生日</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.eventMarker, styles.memoryMarker]} />
                  <Text style={styles.legendText}>时光记</Text>
                </View>
              </View>
            </View>

            <View testID="事项列表" style={styles.timeline}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{selectedHeading}</Text>
                <Text style={styles.groupMeta}>农历{selectedLunar}</Text>
              </View>

              {selectedFestivals.map((festival) => (
                <TimelineRow
                  key={festival}
                  kind="festival"
                  title={festival}
                  detail="节日与节气 · 全天"
                  trailingTop="全天"
                  theme={theme}
                  styles={styles}
                />
              ))}
              {selectedEvents.map((event) => (
                <TimelineRow
                  key={event.id}
                  kind={event.kind}
                  title={event.title}
                  detail={event.detail}
                  trailingTop="全天"
                  theme={theme}
                  styles={styles}
                />
              ))}
              {selectedFestivals.length === 0 && selectedEvents.length === 0 ? (
                <Text style={styles.emptyText}>暂无事项</Text>
              ) : null}

              {upcomingEvents.length > 0 ? (
                <>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>接下来</Text>
                    <Text style={styles.groupMeta}>未来 30 天</Text>
                  </View>
                  {upcomingEvents.map((event) => (
                    <TimelineRow
                      key={event.id}
                      kind={event.kind}
                      title={event.title}
                      detail={event.detail}
                      trailingTop={shortDate(event.date)}
                      trailingBottom={relativeLabel(event.date, today)}
                      onPress={() => selectDate(event.date)}
                      theme={theme}
                      styles={styles}
                    />
                  ))}
                </>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新增事项"
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Ionicons name="add" size={27} color={theme.colors.selectedText} accessible={false} />
        </Pressable>
        <BottomNavigation theme={theme} styles={styles} />
      </View>
    </View>
  );
}

function createStyles(theme: DesignPreviewTheme) {
  const { colors, typography, spacing, radius, size } = theme;
  return StyleSheet.create({
    stage: { flex: 1, backgroundColor: colors.background },
    desktopStage: {
      alignItems: 'center',
      backgroundColor: colors.backdrop,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    phone: { flex: 1, position: 'relative', width: '100%', backgroundColor: colors.surface },
    desktopPhone: {
      maxHeight: 860,
      maxWidth: size.desktopCanvas,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    scrollContent: {
      backgroundColor: colors.surface,
      paddingBottom: size.bottomNavigation + size.addButton + spacing.xl,
    },
    appBar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: Platform.OS === 'web' ? 54 : 78,
      paddingHorizontal: spacing.md,
      paddingTop: Platform.OS === 'web' ? 0 : spacing.xl,
    },
    brandRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    brandMark: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: radius.sm,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    brandName: {
      color: colors.textPrimary,
      fontSize: typography.appTitle,
      fontWeight: typography.bold,
    },
    todayAction: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: size.iconButton,
      paddingHorizontal: spacing.xs,
    },
    todayActionText: {
      color: colors.accent,
      fontSize: typography.label,
      fontWeight: typography.semibold,
    },
    calendarSection: { backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
    monthToolbar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 58,
      paddingLeft: spacing.xs,
    },
    monthTitle: {
      color: colors.textPrimary,
      fontSize: typography.monthTitle,
      fontWeight: typography.bold,
      letterSpacing: -0.6,
    },
    monthActions: { alignItems: 'center', flexDirection: 'row' },
    iconButton: {
      alignItems: 'center',
      height: size.iconButton,
      justifyContent: 'center',
      width: size.iconButton,
    },
    weekRow: { flexDirection: 'row' },
    weekday: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: typography.caption,
      fontWeight: typography.semibold,
      paddingBottom: spacing.xs,
      textAlign: 'center',
    },
    weekend: { color: colors.accent },
    dayCell: {
      alignItems: 'center',
      borderRadius: radius.sm,
      flex: 1,
      height: size.dayCell,
      paddingTop: spacing.xxs,
    },
    dayCellPressed: { backgroundColor: colors.pressed },
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
    dayHelper: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      marginTop: spacing.xxs,
      maxWidth: '96%',
    },
    festivalHelper: { color: colors.festival, fontWeight: typography.semibold },
    markerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.xxs,
      height: 6,
      justifyContent: 'center',
      marginTop: 1,
    },
    eventMarker: { borderRadius: radius.round, height: 4, width: 4 },
    birthdayMarker: { backgroundColor: colors.birthday },
    festivalMarker: { backgroundColor: colors.festival },
    memoryMarker: { backgroundColor: colors.memory },
    calendarLegend: {
      flexDirection: 'row',
      gap: spacing.lg,
      justifyContent: 'center',
      minHeight: 30,
      paddingTop: spacing.xs,
    },
    legendItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
    legendText: { color: colors.textSecondary, fontSize: typography.caption },
    timeline: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
    groupHeader: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 38,
      paddingHorizontal: spacing.md,
    },
    groupTitle: {
      color: colors.selected,
      fontSize: typography.sectionTitle,
      fontWeight: typography.bold,
    },
    groupMeta: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      fontWeight: typography.medium,
    },
    timelineRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 66,
      paddingHorizontal: spacing.md,
      paddingRight: size.addButton + spacing.lg,
      paddingVertical: spacing.sm,
    },
    timelineRail: { alignSelf: 'stretch', borderRadius: radius.round, marginRight: spacing.sm, width: 3 },
    eventIconWrap: {
      alignItems: 'center',
      borderRadius: radius.sm,
      height: size.eventIcon,
      justifyContent: 'center',
      width: size.eventIcon,
    },
    birthdayIconWrap: { backgroundColor: colors.birthdaySoft },
    festivalIconWrap: { backgroundColor: colors.festivalSoft },
    memoryIconWrap: { backgroundColor: colors.memorySoft },
    timelineCopy: { flex: 1, marginLeft: spacing.sm, minWidth: 0 },
    timelineTitle: {
      color: colors.textPrimary,
      fontSize: typography.body,
      fontWeight: typography.semibold,
    },
    timelineDetail: { color: colors.textSecondary, fontSize: typography.label, marginTop: spacing.xxs },
    timelineTrailing: { alignItems: 'flex-end', marginLeft: spacing.sm, marginRight: spacing.xs },
    timelineDate: { color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.medium },
    timelineRelative: {
      fontSize: typography.caption,
      fontWeight: typography.semibold,
      marginTop: spacing.xxs,
    },
    emptyText: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      color: colors.textSecondary,
      fontSize: typography.label,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
    },
    bottomNavigation: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      bottom: 0,
      flexDirection: 'row',
      height: Platform.OS === 'web' ? size.bottomNavigation : size.bottomNavigation + 14,
      left: 0,
      paddingBottom: Platform.OS === 'web' ? 0 : spacing.md,
      position: 'absolute',
      right: 0,
    },
    navItem: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    navLabel: {
      color: colors.navInactive,
      fontSize: typography.caption,
      fontWeight: typography.medium,
      marginTop: spacing.xxs,
    },
    navLabelSelected: { color: colors.accent, fontWeight: typography.semibold },
    addButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderColor: colors.surface,
      borderRadius: radius.round,
      borderWidth: 3,
      bottom: (Platform.OS === 'web' ? size.bottomNavigation : size.bottomNavigation + 14) + spacing.md,
      height: size.addButton,
      justifyContent: 'center',
      position: 'absolute',
      right: spacing.lg,
      width: size.addButton,
    },
    addButtonPressed: { backgroundColor: colors.selected },
    rowPressed: { backgroundColor: colors.pressed },
  });
}
