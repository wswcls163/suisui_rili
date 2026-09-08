import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { dayNumber, supported } from '../core/dates';
import { Button, colors, common, Dialog, Icon } from './ui';

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

export function DateCalculatorDialog({ today, onClose }: { today: string; onClose: () => void }) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
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
    <Dialog visible title="日期计算" onClose={onClose}>
      <View style={styles.intro}>
        <View style={styles.icon}>
          <Icon name="calculator-outline" color={colors.accent} size={24} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={common.body}>想起以前的某一天？</Text>
          <Text style={common.muted}>输入日期，立即看看它距离今天有多少天。</Text>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>想计算的日期</Text>
        <View style={styles.dateRow}>
          <TextInput
            accessibilityLabel="年份"
            autoFocus
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={(value) => setYear(numericPart(value, 4))}
            placeholder="2020"
            placeholderTextColor="#A0A5A1"
            style={[common.input, styles.yearInput]}
            value={year}
          />
          <Text style={styles.separator}>年</Text>
          <TextInput
            accessibilityLabel="月份"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={(value) => setMonth(numericPart(value, 2))}
            placeholder="3"
            placeholderTextColor="#A0A5A1"
            style={[common.input, styles.shortInput]}
            value={month}
          />
          <Text style={styles.separator}>月</Text>
          <TextInput
            accessibilityLabel="日期"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={(value) => setDay(numericPart(value, 2))}
            placeholder="5"
            placeholderTextColor="#A0A5A1"
            style={[common.input, styles.shortInput]}
            value={day}
          />
          <Text style={styles.separator}>日</Text>
        </View>
        <Text style={complete && !valid ? common.error : common.muted}>
          {complete && !valid
            ? '请输入 1901—2100 年内的有效日期'
            : '年份输入 4 位，月份和日期可以直接输入 1—2 位数字'}
        </Text>
      </View>
      {result && difference !== null && (
        <View accessibilityLiveRegion="polite" style={styles.result}>
          <Text style={common.eyebrow}>{readableDate(input)} 距今天</Text>
          <Text style={styles.resultNumber}>{result}</Text>
          <Text style={styles.resultYears}>{equivalentYears(difference)}</Text>
          <Text style={common.muted}>按自然日计算 · 今天是 {today.replaceAll('-', '.')}</Text>
        </View>
      )}
      <Text style={[common.muted, { textAlign: 'center' }]}>仅用于本次查询，不会保存，也不会参与同步。</Text>
      <Button label="完成" onPress={onClose} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#FAF7F3',
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  inputGroup: { gap: 8, marginTop: 18 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  yearInput: { flex: 1.45, minWidth: 0, textAlign: 'center' },
  shortInput: { flex: 1, minWidth: 0, textAlign: 'center' },
  separator: { color: colors.muted, fontSize: 14 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  result: { gap: 8, padding: 20, marginVertical: 18, borderRadius: 16, backgroundColor: '#F5F7F2' },
  resultNumber: { fontSize: 28, lineHeight: 38, fontWeight: '700', color: colors.accent },
  resultYears: { fontSize: 17, lineHeight: 25, fontWeight: '600', color: colors.green },
});
