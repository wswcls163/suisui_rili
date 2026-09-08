import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { dayNumber, supported } from '../core/dates';
import { Button, colors, common, Dialog, Icon } from './ui';

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function readableDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function DateCalculatorDialog({ today, onClose }: { today: string; onClose: () => void }) {
  const [input, setInput] = useState('');
  const valid = supported(input) && supported(today);
  const difference = useMemo(
    () => (valid ? dayNumber(today) - dayNumber(input) : null),
    [input, today, valid],
  );
  const complete = input.length === 10;
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
        <TextInput
          accessibilityLabel="想计算的日期"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(value) => setInput(formatDateInput(value))}
          placeholder="例如：20200928"
          placeholderTextColor="#A0A5A1"
          style={common.input}
          value={input}
        />
        <Text style={complete && !valid ? common.error : common.muted}>
          {complete && !valid ? '请输入 1901—2100 年内的有效日期' : '输入 8 位数字，会自动整理为 YYYY-MM-DD'}
        </Text>
      </View>
      {result && difference !== null && (
        <View accessibilityLiveRegion="polite" style={styles.result}>
          <Text style={common.eyebrow}>{readableDate(input)} 距今天</Text>
          <Text style={styles.resultNumber}>{result}</Text>
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
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  result: { gap: 8, padding: 20, marginVertical: 18, borderRadius: 16, backgroundColor: '#F5F7F2' },
  resultNumber: { fontSize: 28, lineHeight: 38, fontWeight: '700', color: colors.accent },
});
