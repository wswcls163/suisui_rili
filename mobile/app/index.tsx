import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useBirthdays } from '../src/state/AppProvider';
import {
  adjustmentText,
  birthdayTitle,
  birthdayDates,
  occurrenceLabel,
  entriesForMonth,
  type BirthdayRow,
} from '../src/core/birthday';
import { lunarCalendar, lunarLabel } from '../src/core/calendar';
import { festivalsOn } from '../src/core/festivals';
import { supported } from '../src/core/dates';
import { MonthCalendar } from '../src/components/MonthCalendar';
import { Avatar, Button, colors, common, Icon } from '../src/components/ui';
import { storageDescription } from '../src/data/repository';
import { useAuth } from '../src/state/AuthProvider';
import { useAccountSync } from '../src/state/SyncProvider';

function PersonRow({ row }: { row: BirthdayRow }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${birthdayTitle(row.person.name)}`}
      onPress={() => router.push({ pathname: '/birthday/[id]', params: { id: row.person.id } })}
      style={({ pressed }) => [styles.person, pressed && { backgroundColor: '#FAF8F4' }]}
    >
      <Avatar name={row.person.name} id={row.person.id} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={styles.personName}>{birthdayTitle(row.person.name)}</Text>
        <Text style={common.muted}>{birthdayDates(row.person)}</Text>
        {row.next && <Text style={common.muted}>下次 · {occurrenceLabel(row.next)}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={[styles.remaining, row.remaining === 0 && { color: colors.accent }]}>
          {row.remaining === null ? '超出支持范围' : row.remaining === 0 ? '今天' : `${row.remaining} 天后`}
        </Text>
        <Text style={common.muted}>{row.next?.solar.replaceAll('-', '.')}</Text>
      </View>
      <Icon name="chevron-forward" size={16} color="#9BA19B" />
    </Pressable>
  );
}
export default function Home() {
  const state = useBirthdays();
  const auth = useAuth();
  const sync = useAccountSync();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<'calendar' | 'book'>('calendar');
  useFocusEffect(state.refreshToday);
  const entries = useMemo(
    () => entriesForMonth(lunarCalendar, state.people, state.month),
    [state.people, state.month],
  );
  const selected = entries.filter((entry) => entry.occurrence.solar === state.selectedDate);
  const selectedLunar = lunarCalendar.lunarOn(state.selectedDate);
  const selectedFestivals = festivalsOn(state.selectedDate);
  const create = () => router.push('/new');
  return (
    <SafeAreaView style={common.page}>
      <ScrollView contentContainerStyle={[common.content, width < 600 && { padding: 14, gap: 20 }]}>
        <View style={[common.between, { marginBottom: 6 }]}>
          <View style={common.row}>
            <View style={styles.brandIcon}>
              <Icon name="calendar-outline" color="#FFF" size={23} />
            </View>
            <View>
              <Text style={styles.brand}>岁岁日历</Text>
              <Text style={[common.eyebrow, { fontSize: 8, marginTop: 4 }]}>SUISUI CALENDAR</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="账号与同步"
            onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.localChip, pressed && { opacity: 0.68 }]}
          >
            <Icon
              name={auth.session ? 'cloud-done-outline' : 'person-outline'}
              size={15}
              color={sync.status === 'error' ? colors.error : colors.green}
            />
            <Text style={{ fontSize: 11, color: sync.status === 'error' ? colors.error : colors.green }}>
              {auth.status === 'unconfigured'
                ? '本地使用'
                : !auth.session
                  ? '登录'
                  : sync.status === 'syncing'
                    ? '同步中'
                    : sync.status === 'error'
                      ? '同步失败'
                      : sync.status === 'conflict'
                        ? '待处理'
                        : '已登录'}
            </Text>
          </Pressable>
        </View>
        <View style={[common.between, { flexWrap: 'wrap', gap: 20 }]}>
          <View>
            <Text style={common.eyebrow}>记住每一个重要的日子</Text>
            <Text style={[common.title, { marginTop: 8 }]}>我的日历</Text>
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {(
              [
                { key: 'calendar', label: '日历', icon: 'calendar-outline' },
                { key: 'book', label: `生日簿 ${state.people.length}`, icon: 'book-outline' },
              ] as const
            ).map((item) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.key }}
                accessibilityLabel={item.label}
                key={item.key}
                onPress={() => {
                  setTab(item.key);
                  state.refreshToday();
                }}
                style={[styles.tab, tab === item.key && styles.activeTab]}
              >
                <Icon name={item.icon} color={tab === item.key ? colors.accent : colors.muted} size={16} />
                <Text
                  style={{
                    color: tab === item.key ? colors.accent : colors.muted,
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={common.muted}>
          今天 {state.today.replaceAll('-', '.')}　
          {supported(state.today)
            ? `农历${lunarLabel(lunarCalendar.lunarOn(state.today))}`
            : '设备日期超出历法支持范围'}{' '}
          · 北京时间
        </Text>
        {state.status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={common.muted}>正在读取生日…</Text>
          </View>
        ) : state.status === 'error' ? (
          <View style={[common.card, { gap: 14 }]}>
            <Text style={common.heading}>暂时无法读取生日</Text>
            <Text accessibilityRole="alert" style={common.error}>
              {state.error}
            </Text>
            <Text style={common.muted}>现有数据不会被重置。请重试，或检查设备存储是否可用。</Text>
            <Button label="重新读取" onPress={() => void state.reload()} />
          </View>
        ) : (
          <>
            {!!state.notice && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭提示"
                onPress={() => state.setNotice('')}
                style={styles.notice}
              >
                <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.green, fontSize: 14 }}>
                  {state.notice}
                </Text>
                <Icon name="close" size={16} color={colors.green} />
              </Pressable>
            )}
            <View
              style={[
                styles.reminder,
                state.todayRows.length > 0 && { backgroundColor: colors.ink, borderColor: colors.ink },
              ]}
            >
              <View
                style={[styles.reminderIcon, state.todayRows.length > 0 && { backgroundColor: '#465052' }]}
              >
                <Icon
                  name="gift-outline"
                  size={24}
                  color={state.todayRows.length ? '#EDBEA6' : colors.accent}
                />
              </View>
              <View style={{ flex: 1, gap: 7 }}>
                <Text
                  style={[common.heading, { fontSize: 17 }, state.todayRows.length > 0 && { color: '#FFF' }]}
                >
                  {state.todayRows.length
                    ? `今天有 ${state.todayRows.length} 位亲友过生日`
                    : '今天没有生日提醒'}
                </Text>
                {state.todayRows.length ? (
                  state.todayRows.map(({ person, next }) => (
                    <Pressable
                      key={person.id}
                      accessibilityRole="button"
                      accessibilityLabel={`今天：${birthdayTitle(person.name)}`}
                      onPress={() => router.push({ pathname: '/birthday/[id]', params: { id: person.id } })}
                    >
                      <Text style={{ fontSize: 13, lineHeight: 22, color: '#EBE7E1' }}>
                        {birthdayTitle(person.name)} · {birthdayDates(person, next?.kinds)}
                        {next?.kinds.length === 2 ? '（农历与阳历生日同一天）' : ''}
                        {next?.adjustments
                          .map((code) => `（${adjustmentText(code, person.lunar?.month ?? 0)}）`)
                          .join('')}
                        　›
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={common.muted}>
                    {state.people.length ? '重要的日子，都好好记着。' : '从一个生日开始，把牵挂记在这里。'}
                  </Text>
                )}
              </View>
            </View>
            {tab === 'calendar' ? (
              <View style={[styles.workspace, { flexDirection: wide ? 'row' : 'column' }]}>
                <View style={wide ? { flex: 2.25 } : undefined}>
                  <MonthCalendar
                    month={state.month}
                    today={state.today}
                    selected={state.selectedDate}
                    entries={entries}
                    onSelect={state.selectDate}
                    onMonth={state.viewMonth}
                    onToday={() => state.selectDate(state.today)}
                  />
                </View>
                <View style={[common.card, { gap: 20 }, wide && { flex: 1 }]}>
                  <View style={common.between}>
                    <View style={{ gap: 6 }}>
                      <Text style={common.eyebrow}>
                        {state.selectedDate === state.today ? '今天' : '所选日期'}
                      </Text>
                      <Text style={common.title}>
                        {Number(state.selectedDate.slice(5, 7))} 月 {Number(state.selectedDate.slice(8))} 日
                      </Text>
                      <Text style={common.muted}>
                        {selectedLunar.year} 农历年 · {lunarLabel(selectedLunar)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`在 ${state.selectedDate} 新建事项`}
                      onPress={create}
                      style={styles.add}
                    >
                      <Icon name="add" color="#FFF" size={26} />
                    </Pressable>
                  </View>
                  {selectedFestivals.length > 0 && (
                    <View style={[common.row, { flexWrap: 'wrap' }]}>
                      {selectedFestivals.map((name) => (
                        <View key={name} style={styles.festivalTag}>
                          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                            {name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={{ height: 1, backgroundColor: colors.line }} />
                  <Text style={[common.heading, { fontSize: 14 }]}>
                    这一天的事项　<Text style={{ color: colors.muted }}>{selected.length}</Text>
                  </Text>
                  {selected.length ? (
                    selected.map(({ id, person, occurrence }) => (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        accessibilityLabel={`查看${birthdayTitle(person.name)}详情`}
                        onPress={() => router.push({ pathname: '/birthday/[id]', params: { id: person.id } })}
                        style={[common.row, { alignItems: 'flex-start' }]}
                      >
                        <Avatar name={person.name} id={person.id} size={38} />
                        <View style={{ flex: 1, gap: 5 }}>
                          <Text style={styles.personName}>{birthdayTitle(person.name)}</Text>
                          <Text style={common.muted}>{birthdayDates(person, occurrence.kinds)}</Text>
                          {occurrence.kinds.length === 2 && (
                            <Text style={[common.muted, { color: colors.green }]}>
                              农历与阳历生日 · 同一天
                            </Text>
                          )}
                          {occurrence.adjustments.map((code) => (
                            <Text key={code} style={[common.muted, { color: colors.accent }]}>
                              {adjustmentText(code, person.lunar?.month ?? 0)}
                            </Text>
                          ))}
                        </View>
                        <Icon name="chevron-forward" size={16} color={colors.muted} />
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.emptyDay}>
                      <Icon name="leaf-outline" size={32} color="#ABB4A7" />
                      <Text style={[common.body, { marginTop: 14 }]}>这一天还没有事项</Text>
                      <Text style={[common.muted, { textAlign: 'center', marginTop: 6 }]}>
                        点一下右上角的「＋」，{'\n'}记下亲友的生日。
                      </Text>
                      {!state.people.length && (
                        <Button
                          style={{ marginTop: 18 }}
                          label="添加第一个生日"
                          icon="add"
                          onPress={create}
                        />
                      )}
                    </View>
                  )}
                  <Text
                    style={[common.muted, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 }]}
                  >
                    农历逐年换算，阳历固定月日，两个生日都能记住。
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <View style={common.between}>
                  <Text style={common.muted}>按下次生日由近到远排列</Text>
                  <Button label="新建事项" icon="add" onPress={create} />
                </View>
                <View style={[common.card, { padding: state.people.length ? 4 : 28 }]}>
                  {state.people.length ? (
                    state.rows.map((row) => <PersonRow key={row.person.id} row={row} />)
                  ) : (
                    <View style={[styles.emptyDay, { gap: 15 }]}>
                      <Icon name="book-outline" size={38} color={colors.accent} />
                      <Text style={common.heading}>还没有记下生日</Text>
                      <Text style={common.muted}>先从你最牵挂的那个人开始。</Text>
                      <Button label="添加第一个生日" icon="add" onPress={create} />
                    </View>
                  )}
                </View>
                <Text style={common.muted}>
                  闰月缺失时按普通月过；遇到小月三十，提前到二十九。原始生日始终保留。
                </Text>
              </View>
            )}
          </>
        )}
        <View
          style={[common.row, { alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 8 }]}
        >
          <Icon name="lock-closed-outline" size={14} color={colors.muted} />
          <Text style={[common.muted, { flexShrink: 1, fontSize: 11, lineHeight: 18 }]}>
            {storageDescription} 仅在应用内提醒。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  festivalTag: { backgroundColor: colors.tint, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  brand: { fontSize: 22, fontWeight: '600', color: colors.ink, letterSpacing: 3 },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EAF0E9',
  },
  tabs: { flexDirection: 'row', backgroundColor: '#EDEEE9', borderRadius: 13, padding: 4, gap: 2 },
  tab: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  activeTab: { backgroundColor: '#FFF' },
  reminder: {
    backgroundColor: '#FBFAF6',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  reminderIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspace: { gap: 22, alignItems: 'stretch' },
  add: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDay: { minHeight: 190, alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  person: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    borderRadius: 15,
  },
  personName: { fontSize: 16, fontWeight: '600', color: colors.ink },
  remaining: { fontSize: 15, fontWeight: '600', color: colors.ink },
  loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 14 },
  notice: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EAF0E9',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});
