import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  birthdayAgeText,
  birthdayDates,
  birthdayTitle,
  occurrenceLabel,
  type BirthdayRow,
} from '../../core/birthday';
import { anniversaryProgress, timeNoteProgressText, type Countup } from '../../core/countup';
import { Avatar, Icon } from '../ui';
import { defaultHomeTheme, type HomeTheme } from './homeTheme';

function AddAction({ label, onPress, theme, styles }: ActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.addAction, pressed && styles.pressed]}
    >
      <Icon name="add" size={18} color={theme.colors.accent} />
      <Text style={styles.addActionText}>{label}</Text>
    </Pressable>
  );
}

type ActionProps = {
  label: string;
  onPress: () => void;
  theme: HomeTheme;
  styles: ReturnType<typeof createStyles>;
};

function PersonRow({
  row,
  onOpen,
  theme,
  styles,
}: {
  row: BirthdayRow;
  onOpen: (id: string) => void;
  theme: HomeTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const age = row.next ? birthdayAgeText(row.person, row.next) : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${birthdayTitle(row.person.name)}${age ? `，${age}` : ''}`}
      onPress={() => onOpen(row.person.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={row.person.name} id={row.person.id} size={40} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{birthdayTitle(row.person.name)}</Text>
        <Text style={styles.rowDetail}>{birthdayDates(row.person)}</Text>
        {row.next ? (
          <Text style={styles.rowDetail}>
            下次 · {occurrenceLabel(row.next)}
            {age ? ` · ${age}` : ''}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowTrailing}>
        <Text style={[styles.rowValue, row.remaining === 0 && { color: theme.colors.accent }]}>
          {row.remaining === null ? '超出范围' : row.remaining === 0 ? '今天' : `${row.remaining} 天后`}
        </Text>
        <Text style={styles.rowDetail}>{row.next?.solar.replaceAll('-', '.')}</Text>
      </View>
      <Icon name="chevron-forward" size={16} color={theme.colors.textTertiary} />
    </Pressable>
  );
}

function CountupRow({
  item,
  today,
  onOpen,
  theme,
  styles,
}: {
  item: Countup;
  today: string;
  onOpen: (id: string) => void;
  theme: HomeTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const progressText = timeNoteProgressText(item, today);
  const anniversary = item.displayMode === 'anniversary' ? anniversaryProgress(item.startDate, today) : null;
  const listText =
    anniversary?.phase === 'active' &&
    !anniversary.isAnniversary &&
    anniversary.nextYears !== null &&
    anniversary.remaining !== null
      ? `距 ${anniversary.nextYears} 周年\n${anniversary.remaining} 天`
      : progressText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看时光记${item.title}，${progressText}`}
      onPress={() => onOpen(item.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.memoryIcon}>
        <Icon name="sparkles-outline" size={20} color={theme.colors.memory} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDetail}>
          {item.displayMode === 'anniversary' ? '每年纪念' : '记录天数'} · 从{' '}
          {item.startDate.replaceAll('-', '.')} 开始
        </Text>
        {item.note ? (
          <Text numberOfLines={1} style={styles.rowDetail}>
            {item.note}
          </Text>
        ) : null}
      </View>
      <Text style={styles.memoryValue}>{listText}</Text>
      <Icon name="chevron-forward" size={16} color={theme.colors.textTertiary} />
    </Pressable>
  );
}

export function BirthdayBook({
  rows,
  onCreate,
  onOpen,
  theme = defaultHomeTheme,
}: {
  rows: BirthdayRow[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  theme?: HomeTheme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text accessibilityRole="header" style={styles.pageTitle}>
            生日簿
          </Text>
          <Text style={styles.sectionDescription}>按下次生日由近到远排列</Text>
        </View>
        <AddAction label="新建事项" onPress={onCreate} theme={theme} styles={styles} />
      </View>
      <View style={styles.list}>
        {rows.length ? (
          rows.map((row) => (
            <PersonRow key={row.person.id} row={row} onOpen={onOpen} theme={theme} styles={styles} />
          ))
        ) : (
          <View style={styles.empty}>
            <Icon name="gift-outline" size={32} color={theme.colors.birthday} />
            <Text style={styles.emptyTitle}>还没有记下生日</Text>
            <Text style={styles.emptyDetail}>先从你最牵挂的那个人开始。</Text>
            <AddAction label="添加第一个生日" onPress={onCreate} theme={theme} styles={styles} />
          </View>
        )}
      </View>
      <Text style={styles.footnote}>闰月和大小月会自动处理，原始生日始终保留。</Text>
    </View>
  );
}

export function CountupBook({
  items,
  today,
  onCreate,
  onOpen,
  theme = defaultHomeTheme,
}: {
  items: Countup[];
  today: string;
  onCreate: () => void;
  onOpen: (id: string) => void;
  theme?: HomeTheme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text accessibilityRole="header" style={styles.pageTitle}>
            时光记
          </Text>
          <Text style={styles.sectionDescription}>记录天数或周年，时间会自动更新</Text>
        </View>
        <AddAction label="新建时光记" onPress={onCreate} theme={theme} styles={styles} />
      </View>
      <View style={styles.list}>
        {items.length ? (
          items.map((item) => (
            <CountupRow
              key={item.id}
              item={item}
              today={today}
              onOpen={onOpen}
              theme={theme}
              styles={styles}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <Icon name="sparkles-outline" size={34} color={theme.colors.memory} />
            <Text style={styles.emptyTitle}>还没有时光记</Text>
            <Text style={styles.emptyDetail}>记录一件正在发生的事，看时间慢慢累积。</Text>
            <AddAction label="添加第一条时光记" onPress={onCreate} theme={theme} styles={styles} />
          </View>
        )}
      </View>
      <Text style={styles.footnote}>适合健身、学习、恋爱、结婚或任何值得记住的开始。</Text>
    </View>
  );
}

function createStyles(theme: HomeTheme) {
  const { colors, typography, spacing, radius } = theme;
  return StyleSheet.create({
    section: { gap: spacing.md, padding: spacing.md },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    sectionCopy: { flex: 1, gap: spacing.xxs },
    pageTitle: { color: colors.textPrimary, fontSize: typography.pageTitle, fontWeight: typography.bold },
    sectionDescription: { color: colors.textSecondary, fontSize: typography.label },
    addAction: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 40,
      paddingHorizontal: spacing.sm,
    },
    addActionText: { color: colors.accent, fontSize: typography.label, fontWeight: typography.semibold },
    list: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    row: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 76,
      padding: spacing.md,
    },
    rowCopy: { flex: 1, gap: spacing.xxs, minWidth: 0 },
    rowTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
    rowDetail: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
    rowTrailing: { alignItems: 'flex-end', gap: spacing.xxs },
    rowValue: { color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.semibold },
    memoryIcon: {
      alignItems: 'center',
      backgroundColor: colors.memorySoft,
      borderRadius: radius.sm,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    memoryValue: {
      color: colors.memory,
      fontSize: typography.label,
      fontWeight: typography.bold,
      textAlign: 'right',
    },
    empty: {
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 210,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    emptyTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
    emptyDetail: { color: colors.textSecondary, fontSize: typography.label, textAlign: 'center' },
    footnote: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 16 },
    pressed: { backgroundColor: colors.pressed },
  });
}
