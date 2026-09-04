import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type BirthdayEntry } from '../core/birthday';
import { DAY_NAMES, MONTH_NAMES, lunarCalendar, lunarLabel } from '../core/calendar';
import { festivalsOn } from '../core/festivals';
import { monthGrid, shiftMonth, supported } from '../core/dates';
import { DateJumpDialog } from './DateJumpDialog';
import { Button, colors, common, Icon } from './ui';

export function MonthCalendar({
  month,
  today,
  selected,
  entries,
  onSelect,
  onMonth,
  onToday,
}: {
  month: string;
  today: string;
  selected: string;
  entries: BirthdayEntry[];
  onSelect: (date: string) => void;
  onMonth: (month: string) => void;
  onToday: () => void;
}) {
  const [jump, setJump] = useState(false);
  const grid = useMemo(() => monthGrid(month), [month]);
  const byDate = useMemo(() => {
    const result = new Map<string, BirthdayEntry[]>();
    for (const entry of entries)
      result.set(entry.occurrence.solar, [...(result.get(entry.occurrence.solar) ?? []), entry]);
    return result;
  }, [entries]);
  return (
    <View style={styles.calendar}>
      <View style={[common.between, { paddingHorizontal: 8, paddingBottom: 20, flexWrap: 'wrap' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="跳转日期"
          onPress={() => setJump(true)}
          style={common.row}
        >
          <Text style={common.heading}>
            {Number(month.slice(0, 4))} 年 {Number(month.slice(5, 7))} 月
          </Text>
          <Icon name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上个月"
            accessibilityState={{ disabled: !supported(shiftMonth(month, -1)) }}
            disabled={!supported(shiftMonth(month, -1))}
            onPress={() => onMonth(shiftMonth(month, -1))}
            style={styles.arrow}
          >
            <Icon name="chevron-back" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="下个月"
            accessibilityState={{ disabled: !supported(shiftMonth(month, 1)) }}
            disabled={!supported(shiftMonth(month, 1))}
            onPress={() => onMonth(shiftMonth(month, 1))}
            style={styles.arrow}
          >
            <Icon name="chevron-forward" />
          </Pressable>
          <Button label="今天" variant="secondary" onPress={onToday} disabled={!supported(today)} />
        </View>
      </View>
      <View style={styles.week}>
        {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>
      {grid.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((date, dayIndex) => {
            if (!date) return <View key={`empty-${dayIndex}`} style={styles.cell} />;
            const lunar = lunarCalendar.lunarOn(date);
            const label =
              lunar.day === 1
                ? `${lunar.isLeap ? '闰' : ''}${MONTH_NAMES[lunar.month - 1]}`
                : DAY_NAMES[lunar.day - 1];
            const birthdays = byDate.get(date) ?? [];
            const festivals = festivalsOn(date);
            const dayLabel = festivals[0] ?? label;
            const isSelected = date === selected;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${date}，农历${lunarLabel(lunar)}${festivals.length ? `，${festivals.join('、')}` : ''}${birthdays.length ? `，${birthdays.length} 位生日：${birthdays.map((b) => b.person.name).join('、')}` : ''}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(date)}
                style={({ pressed }) => [
                  styles.cell,
                  styles.day,
                  date === today && styles.today,
                  isSelected && styles.selected,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.dayNumber, isSelected && styles.white]}>{Number(date.slice(8))}</Text>
                <View style={styles.labelLine}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.lunar,
                      festivals.length > 0 && styles.festival,
                      isSelected && { color: '#FADED4' },
                    ]}
                  >
                    {dayLabel}
                  </Text>
                  {festivals.length > 1 && (
                    <Text style={[styles.labelCount, isSelected && styles.white]}>
                      +{festivals.length - 1}
                    </Text>
                  )}
                </View>
                {birthdays.length > 0 ? (
                  <Text numberOfLines={1} style={[styles.event, isSelected && styles.white]}>
                    {birthdays[0].person.name}
                    {birthdays.length > 1 ? ` +${birthdays.length - 1}` : ''}
                  </Text>
                ) : (
                  <View style={{ minHeight: 15 }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={[common.between, { paddingTop: 18, paddingHorizontal: 8, flexWrap: 'wrap' }]}>
        <Text style={common.muted}>● 有生日　◯ 今天</Text>
        <Text style={common.muted}>选中日期，再点「＋」新建</Text>
      </View>
      {jump && (
        <DateJumpDialog
          initialDate={selected}
          onClose={() => setJump(false)}
          onConfirm={(date) => {
            onSelect(date);
            setJump(false);
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  calendar: { ...common.card, padding: 14 },
  arrow: { width: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  week: { flexDirection: 'row', gap: 3 },
  weekday: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 12 },
  cell: {
    flex: 1,
    minWidth: 0,
    minHeight: 85,
    marginVertical: 2,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  day: { alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 2 },
  dayNumber: { fontSize: 18, color: colors.ink, fontWeight: '500' },
  labelLine: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', marginTop: 4, gap: 1 },
  lunar: { fontSize: 10, color: colors.muted, flexShrink: 1 },
  labelCount: { fontSize: 8, color: colors.accent },
  festival: { color: colors.accent, fontWeight: '600' },
  event: { fontSize: 10, color: colors.accent, marginTop: 4, fontWeight: '500', maxWidth: '100%' },
  today: { borderColor: '#D7AA9D', backgroundColor: '#FCF7F3' },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  white: { color: '#FFF' },
});
