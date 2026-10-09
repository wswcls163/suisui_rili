import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Birthday, BirthdayEntry } from '../../core/birthday';
import { lunarCalendar, lunarLabel } from '../../core/calendar';
import type { Countup } from '../../core/countup';
import { chineseWeekday, dayNumber } from '../../core/dates';
import { importantDateTitle } from '../../core/notification';
import { Icon } from '../ui';
import {
  selectedTimelineItems,
  todayReminderNames,
  upcomingTimelineItems,
  type HomeEventKind,
  type HomeTimelineItem,
} from './homeEvents';
import { defaultHomeTheme, type HomeTheme } from './homeTheme';

function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
}

function relativeText(date: string, from: string): string {
  const distance = dayNumber(date) - dayNumber(from);
  return distance === 0 ? '今天' : distance > 0 ? `${distance}天后` : `${-distance}天前`;
}

function iconFor(kind: HomeEventKind): React.ComponentProps<typeof Icon>['name'] {
  if (kind === 'festival') return 'flag-outline';
  if (kind === 'birthday') return 'gift-outline';
  return 'sparkles-outline';
}

function kindStyles(kind: HomeEventKind, styles: ReturnType<typeof createStyles>) {
  if (kind === 'festival') return [styles.festivalRail, styles.festivalIcon];
  if (kind === 'birthday') return [styles.birthdayRail, styles.birthdayIcon];
  return [styles.memoryRail, styles.memoryIcon];
}

function kindColor(kind: HomeEventKind, theme: HomeTheme): string {
  if (kind === 'festival') return theme.colors.festival;
  if (kind === 'birthday') return theme.colors.birthday;
  return theme.colors.memory;
}

function TimelineRow({
  item,
  from,
  onOpenBirthday,
  onOpenMemory,
  theme,
  styles,
}: {
  item: HomeTimelineItem;
  from: string;
  onOpenBirthday: (id: string) => void;
  onOpenMemory: (id: string) => void;
  theme: HomeTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const actionable = Boolean(item.personId || item.countupId);
  const accessibilityLabel = item.personId
    ? `查看${item.title}详情${item.detail.includes('满 ') ? `，${item.detail.split(' · ').at(-1)}` : ''}`
    : item.countupId
      ? `查看时光记${item.title}，${item.detail.split(' · ').at(-1)}`
      : undefined;
  const [railStyle, iconStyle] = kindStyles(item.kind, styles);
  const open = () => {
    if (item.personId) onOpenBirthday(item.personId);
    if (item.countupId) onOpenMemory(item.countupId);
  };

  return (
    <Pressable
      accessibilityRole={actionable ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!actionable}
      onPress={open}
      style={({ pressed }) => [styles.timelineRow, pressed && styles.pressed]}
    >
      <View style={[styles.timelineRail, railStyle]} />
      <View style={[styles.eventIcon, iconStyle]}>
        <Icon name={iconFor(item.kind)} size={18} color={kindColor(item.kind, theme)} />
      </View>
      <View style={styles.timelineCopy}>
        <Text numberOfLines={1} style={styles.timelineTitle}>
          {item.title}
        </Text>
        <Text style={styles.timelineDetail}>{item.detail}</Text>
        {item.notes.map((note) => (
          <Text key={note} style={[styles.timelineNote, { color: kindColor(item.kind, theme) }]}>
            {note}
          </Text>
        ))}
      </View>
      <View style={styles.timelineTrailing}>
        <Text style={styles.timelineDate}>{shortDate(item.date)}</Text>
        <Text style={[styles.timelineRelative, { color: kindColor(item.kind, theme) }]}>
          {relativeText(item.date, from)}
        </Text>
      </View>
      {actionable ? <Icon name="chevron-forward" size={16} color={theme.colors.textTertiary} /> : null}
    </Pressable>
  );
}

export function HomeCalendarTimeline({
  selectedDate,
  today,
  birthdayEntries,
  todayBirthdayEntries,
  people,
  countups,
  onCreate,
  onOpenBirthday,
  onOpenMemory,
  theme = defaultHomeTheme,
}: {
  selectedDate: string;
  today: string;
  birthdayEntries: BirthdayEntry[];
  todayBirthdayEntries: BirthdayEntry[];
  people: Birthday[];
  countups: Countup[];
  onCreate: () => void;
  onOpenBirthday: (id: string) => void;
  onOpenMemory: (id: string) => void;
  theme?: HomeTheme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedItems = useMemo(
    () => selectedTimelineItems(selectedDate, birthdayEntries, countups),
    [birthdayEntries, countups, selectedDate],
  );
  const todayItems = useMemo(
    () => selectedTimelineItems(today, todayBirthdayEntries, countups),
    [countups, today, todayBirthdayEntries],
  );
  const upcomingItems = useMemo(
    () => upcomingTimelineItems(selectedDate, people, countups),
    [countups, people, selectedDate],
  );
  const reminderNames = todayReminderNames(todayItems);
  const todayBirthdays = todayItems.filter((item) => item.kind === 'birthday');
  const todayFestivals = todayItems.filter((item) => item.kind === 'festival');
  const selectedLunar = lunarCalendar.lunarOn(selectedDate);
  const selectedDistance = dayNumber(selectedDate) - dayNumber(today);
  const heading =
    selectedDate === today
      ? `今天 · ${shortDate(selectedDate)}`
      : `${shortDate(selectedDate)} · ${chineseWeekday(selectedDate)}`;

  return (
    <View testID="事项列表" style={styles.timeline}>
      <View testID="today-reminder" style={styles.todayReminder}>
        <View style={styles.reminderIcon}>
          <Icon
            name={reminderNames.length ? 'notifications-outline' : 'calendar-outline'}
            size={18}
            color={reminderNames.length ? theme.colors.accent : theme.colors.textSecondary}
          />
        </View>
        <View style={styles.reminderCopy}>
          <Text style={styles.reminderTitle}>
            {reminderNames.length ? importantDateTitle(reminderNames) : '今天没有重要日期提醒'}
          </Text>
          {todayFestivals.length ? (
            <Text style={styles.reminderDetail}>
              节日与节气 · {todayFestivals.map((item) => item.title).join('、')}
            </Text>
          ) : null}
          {todayBirthdays.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`今天：${item.title}${item.detail.includes('满 ') ? `，${item.detail.split(' · ').at(-1)}` : ''}`}
              onPress={() => onOpenBirthday(item.personId!)}
            >
              <Text style={styles.reminderDetail}>
                {item.title} · {item.detail}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.groupHeader}>
        <View style={styles.groupCopy}>
          <Text style={styles.groupTitle}>{heading}</Text>
          <Text style={styles.groupLunar}>
            {selectedLunar.year} 农历年 · {lunarLabel(selectedLunar)}
          </Text>
        </View>
        {selectedDistance > 0 ? (
          <Text style={styles.groupDistance}>距离今天还有 {selectedDistance} 天</Text>
        ) : null}
      </View>

      {selectedItems.length ? (
        selectedItems.map((item) => (
          <TimelineRow
            key={item.id}
            item={item}
            from={today}
            onOpenBirthday={onOpenBirthday}
            onOpenMemory={onOpenMemory}
            theme={theme}
            styles={styles}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>暂无事项</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={people.length ? '在这一天新建事项' : '添加第一个生日'}
            onPress={onCreate}
            style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
          >
            <Icon name="add" size={16} color={theme.colors.accent} />
            <Text style={styles.emptyActionText}>{people.length ? '在这一天新建' : '添加第一个生日'}</Text>
          </Pressable>
        </View>
      )}

      {upcomingItems.length ? (
        <>
          <View style={styles.upcomingHeader}>
            <Text style={styles.groupTitle}>接下来</Text>
            <Text style={styles.groupMeta}>未来 30 天</Text>
          </View>
          {upcomingItems.map((item) => (
            <TimelineRow
              key={item.id}
              item={item}
              from={selectedDate}
              onOpenBirthday={onOpenBirthday}
              onOpenMemory={onOpenMemory}
              theme={theme}
              styles={styles}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

function createStyles(theme: HomeTheme) {
  const { colors, typography, spacing, radius, size } = theme;
  return StyleSheet.create({
    timeline: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
    todayReminder: {
      alignItems: 'flex-start',
      backgroundColor: colors.accentSoft,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    reminderIcon: {
      alignItems: 'center',
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    reminderCopy: { flex: 1, gap: spacing.xxs },
    reminderTitle: {
      color: colors.textPrimary,
      fontSize: typography.label,
      fontWeight: typography.semibold,
    },
    reminderDetail: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 16 },
    groupHeader: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 50,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    groupCopy: { flex: 1, gap: spacing.xxs },
    groupTitle: {
      color: colors.selected,
      fontSize: typography.sectionTitle,
      fontWeight: typography.bold,
    },
    groupLunar: { color: colors.textSecondary, fontSize: typography.caption },
    groupDistance: {
      color: colors.accent,
      fontSize: typography.caption,
      fontWeight: typography.semibold,
      marginLeft: spacing.sm,
    },
    groupMeta: { color: colors.textSecondary, fontSize: typography.caption },
    upcomingHeader: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 38,
      paddingHorizontal: spacing.md,
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
    timelineRail: {
      alignSelf: 'stretch',
      borderRadius: radius.round,
      marginRight: spacing.sm,
      width: 3,
    },
    festivalRail: { backgroundColor: colors.festival },
    birthdayRail: { backgroundColor: colors.birthday },
    memoryRail: { backgroundColor: colors.memory },
    eventIcon: {
      alignItems: 'center',
      borderRadius: radius.sm,
      height: size.eventIcon,
      justifyContent: 'center',
      width: size.eventIcon,
    },
    festivalIcon: { backgroundColor: colors.festivalSoft },
    birthdayIcon: { backgroundColor: colors.birthdaySoft },
    memoryIcon: { backgroundColor: colors.memorySoft },
    timelineCopy: { flex: 1, marginLeft: spacing.sm, minWidth: 0 },
    timelineTitle: {
      color: colors.textPrimary,
      fontSize: typography.body,
      fontWeight: typography.semibold,
    },
    timelineDetail: { color: colors.textSecondary, fontSize: typography.label, marginTop: spacing.xxs },
    timelineNote: { fontSize: typography.caption, marginTop: spacing.xxs },
    timelineTrailing: { alignItems: 'flex-end', marginLeft: spacing.sm, marginRight: spacing.xs },
    timelineDate: { color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.medium },
    timelineRelative: {
      fontSize: typography.caption,
      fontWeight: typography.semibold,
      marginTop: spacing.xxs,
    },
    emptyState: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 56,
      paddingHorizontal: spacing.md,
    },
    emptyTitle: { color: colors.textSecondary, fontSize: typography.label },
    emptyAction: {
      alignItems: 'center',
      borderRadius: radius.sm,
      flexDirection: 'row',
      gap: spacing.xxs,
      minHeight: 36,
      paddingHorizontal: spacing.sm,
    },
    emptyActionText: { color: colors.accent, fontSize: typography.label, fontWeight: typography.semibold },
    pressed: { backgroundColor: colors.pressed },
  });
}
