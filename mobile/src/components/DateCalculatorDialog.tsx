import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { dayNumber, supported } from '../core/dates';
import { defaultHomeTheme, type HomeTheme } from './home/homeTheme';
import { Dialog, Icon } from './ui';

const AVERAGE_GREGORIAN_YEAR_DAYS = 365.2425;

function numericPart(value: string, length: number): string {
  return value.replace(/\D/g, '').slice(0, length);
}

function equivalentYears(days: number): string {
  if (days === 0) return '0 年';
  const years = Math.abs(days) / AVERAGE_GREGORIAN_YEAR_DAYS;
  return years < 0.01 ? '不足 0.01 年' : `约 ${years.toFixed(2)} 年`;
}

function readableDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

type CalculatorField = 'year' | 'month' | 'day';

export function DateCalculatorDialog({
  today,
  onClose,
  theme = defaultHomeTheme,
}: {
  today: string;
  onClose: () => void;
  theme?: HomeTheme;
}) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [focused, setFocused] = useState<CalculatorField | null>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const complete = year.length === 4 && month.length > 0 && day.length > 0;
  const input = complete ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '';
  const valid = complete && supported(input) && supported(today);
  const difference = useMemo(
    () => (valid ? dayNumber(today) - dayNumber(input) : null),
    [input, today, valid],
  );
  const result =
    difference === null
      ? null
      : difference > 0
        ? `已经过去 ${difference} 天`
        : difference < 0
          ? `距离那天还有 ${-difference} 天`
          : '就是今天';

  return (
    <Dialog
      visible
      title="日期计算"
      onClose={onClose}
      dialogStyle={styles.dialog}
      headerStyle={styles.dialogHeader}
      titleStyle={styles.dialogTitle}
    >
      <View style={styles.intro}>
        <View style={styles.icon}>
          <Icon name="calendar-clear-outline" color={theme.colors.accent} size={20} />
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>想起某一天？</Text>
          <Text style={styles.introText}>输入日期，看看它离今天有多久。</Text>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.sectionLabel}>想计算的日期</Text>
        <View testID="日期计算输入区" style={styles.dateRow}>
          {(
            [
              ['year', '年', '2020', 4, year, setYear],
              ['month', '月', '3', 2, month, setMonth],
              ['day', '日', '5', 2, day, setDay],
            ] as const
          ).map(([key, label, placeholder, maxLength, value, setValue]) => (
            <View key={key} style={[styles.field, key === 'year' && styles.yearField]}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                accessibilityLabel={key === 'year' ? '年份' : key === 'month' ? '月份' : '日期'}
                accessibilityHint={`输入${label}，无需补零`}
                autoFocus={key === 'year'}
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={maxLength}
                onBlur={() => setFocused((current) => (current === key ? null : current))}
                onChangeText={(nextValue) => setValue(numericPart(nextValue, maxLength))}
                onFocus={() => setFocused(key)}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textTertiary}
                selectTextOnFocus={false}
                style={[styles.input, focused === key && styles.inputFocused]}
                value={value}
              />
            </View>
          ))}
        </View>
        <Text accessibilityLiveRegion="polite" style={complete && !valid ? styles.error : styles.helper}>
          {complete && !valid
            ? '请输入 1901—2100 年内的有效日期'
            : '年份 4 位，月份和日期直接输入 1—2 位数字'}
        </Text>
      </View>
      {result && difference !== null && (
        <View testID="日期计算结果" accessibilityLiveRegion="polite" style={styles.result}>
          <View style={styles.resultHeading}>
            <View style={styles.resultMark} />
            <Text style={styles.resultDate}>{readableDate(input)} 距今天</Text>
          </View>
          <Text style={styles.resultNumber}>{result}</Text>
          <View style={styles.resultMetaRow}>
            <Text style={styles.resultYears}>{equivalentYears(difference)}</Text>
            <Text style={styles.resultMeta}>今天 {today.replaceAll('-', '.')}</Text>
          </View>
        </View>
      )}
      <View style={styles.privateNote}>
        <Icon name="shield-checkmark-outline" color={theme.colors.textTertiary} size={15} />
        <Text style={styles.privateText}>仅用于本次查询，不会保存，也不会参与同步。</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="完成"
        onPress={onClose}
        style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
      >
        <Text style={styles.doneButtonText}>完成</Text>
      </Pressable>
    </Dialog>
  );
}

function createStyles(theme: HomeTheme) {
  return StyleSheet.create({
    dialog: {
      maxWidth: 460,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
    },
    dialogHeader: { marginBottom: theme.spacing.md },
    dialogTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.appTitle,
      fontWeight: theme.typography.bold,
    },
    intro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    icon: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accentSoft,
    },
    introCopy: { flex: 1, minWidth: 0, gap: theme.spacing.xxs },
    introTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.body,
      fontWeight: theme.typography.semibold,
    },
    introText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.label,
      lineHeight: 18,
    },
    inputGroup: { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
    sectionLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.label,
      fontWeight: theme.typography.semibold,
    },
    dateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
    field: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
    yearField: { flex: 1.22 },
    fieldLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.caption,
      fontWeight: theme.typography.medium,
    },
    input: {
      width: '100%',
      minWidth: 0,
      minHeight: 46,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.background,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.body,
      fontWeight: theme.typography.medium,
      textAlign: 'center',
    },
    inputFocused: {
      borderColor: theme.colors.selected,
      backgroundColor: theme.colors.surface,
    },
    helper: {
      color: theme.colors.textTertiary,
      fontSize: theme.typography.caption,
      lineHeight: 16,
    },
    error: {
      color: theme.colors.error,
      fontSize: theme.typography.caption,
      lineHeight: 16,
    },
    result: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      marginTop: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resultHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    resultMark: {
      width: 6,
      height: 6,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.selected,
    },
    resultDate: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.typography.caption,
      fontWeight: theme.typography.medium,
    },
    resultNumber: {
      color: theme.colors.textPrimary,
      fontSize: 25,
      lineHeight: 33,
      fontWeight: theme.typography.bold,
    },
    resultMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    resultYears: {
      color: theme.colors.memory,
      fontSize: theme.typography.body,
      fontWeight: theme.typography.semibold,
    },
    resultMeta: { color: theme.colors.textTertiary, fontSize: theme.typography.caption },
    privateNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.md,
    },
    privateText: {
      flexShrink: 1,
      color: theme.colors.textTertiary,
      fontSize: theme.typography.caption,
      lineHeight: 16,
      textAlign: 'center',
    },
    doneButton: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.textPrimary,
    },
    doneButtonPressed: { opacity: 0.76 },
    doneButtonText: {
      color: theme.colors.surface,
      fontSize: theme.typography.body,
      fontWeight: theme.typography.semibold,
    },
  });
}
