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

type PreviewEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind: 'birthday' | 'memory';
  initial: string;
};

type DesignPreviewHomeProps = {
  today: string;
};

const palette = {
  canvas: '#E8E5DE',
  paper: '#F6F4EF',
  surface: '#FFFEFB',
  ink: '#202827',
  muted: '#69716D',
  faint: '#939995',
  line: '#DFDDD6',
  clay: '#B4513D',
  claySoft: '#F3E3DC',
  forest: '#4F6D5C',
  forestSoft: '#DFE9E2',
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
      detail: '阳历生日 · 已开启提醒',
      kind: 'birthday',
      initial: '妈',
    },
    {
      id: 'travel-memory',
      date: addDays(today, 10),
      title: '一起旅行纪念',
      detail: '每年纪念 · 第 3 年',
      kind: 'memory',
      initial: '',
    },
    {
      id: 'friend-birthday',
      date: addDays(today, 17),
      title: '阿宁的生日',
      detail: '农历生日 · 已开启提醒',
      kind: 'birthday',
      initial: '宁',
    },
  ];
}

function EventThumb({ event, compact = false }: { event: PreviewEvent; compact?: boolean }) {
  const birthday = event.kind === 'birthday';
  return (
    <View
      accessibilityLabel={birthday ? `${event.title}头像` : `${event.title}缩略图`}
      style={[
        styles.eventThumb,
        compact && styles.eventThumbCompact,
        birthday ? styles.birthdayThumb : styles.memoryThumb,
      ]}
    >
      {birthday ? (
        <Text style={styles.avatarText}>{event.initial}</Text>
      ) : (
        <Ionicons name="images-outline" size={compact ? 17 : 20} color={palette.forest} accessible={false} />
      )}
    </View>
  );
}

function PreviewDay({
  date,
  today,
  selected,
  event,
  onPress,
}: {
  date: string | null;
  today: string;
  selected: boolean;
  event?: PreviewEvent;
  onPress: (date: string) => void;
}) {
  if (!date) return <View style={styles.dayCell} />;
  const day = Number(date.slice(8));
  const lunar = lunarCalendar.lunarOn(date);
  const festival = festivalsOn(date)[0];
  const helper = festival ?? lunarLabel(lunar);
  const isToday = date === today;
  const description = [
    `${Number(date.slice(5, 7))}月${day}日`,
    isToday ? '今天' : '',
    event?.title ?? festival ?? '',
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
      <Text
        numberOfLines={1}
        style={[
          styles.dayHelper,
          festival && styles.festivalHelper,
          selected && !festival && styles.selectedHelper,
        ]}
      >
        {helper}
      </Text>
      <View style={styles.markerRow}>
        {event ? (
          <View
            accessibilityLabel={event.kind === 'birthday' ? '有生日' : '有时光记录'}
            style={[styles.eventDot, event.kind === 'birthday' ? styles.birthdayDot : styles.memoryDot]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function RecordRow({
  event,
  today,
  onPress,
  divider = true,
}: {
  event: PreviewEvent;
  today: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}，${shortDate(event.date)}，${relativeLabel(event.date, today)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.recordRow, divider && styles.rowDivider, pressed && styles.rowPressed]}
    >
      <EventThumb event={event} />
      <View style={styles.recordCopy}>
        <Text numberOfLines={1} style={styles.recordTitle}>
          {event.title}
        </Text>
        <Text numberOfLines={1} style={styles.recordDetail}>
          {event.detail}
        </Text>
      </View>
      <View style={styles.recordDateBlock}>
        <Text style={styles.recordDate}>{shortDate(event.date)}</Text>
        <Text style={styles.recordRelative}>{relativeLabel(event.date, today)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={palette.faint} accessible={false} />
    </Pressable>
  );
}

function BottomNavigation() {
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
              color={selected ? palette.clay : palette.muted}
              accessible={false}
            />
            <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{item.label}</Text>
            {selected ? <View style={styles.navIndicator} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function DesignPreviewHome({ today }: DesignPreviewHomeProps) {
  const { width } = useWindowDimensions();
  const desktopFrame = Platform.OS === 'web' && width >= 700;
  const [visibleMonth, setVisibleMonth] = useState(monthStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const events = useMemo(() => createPreviewEvents(today), [today]);
  const eventByDate = useMemo(() => new Map(events.map((event) => [event.date, event])), [events]);
  const nearest = events.find((event) => event.date >= today) ?? events[0];
  const selectedEvent = eventByDate.get(selectedDate);
  const selectedFestivals = festivalsOn(selectedDate);
  const selectedLunar = lunarLabel(lunarCalendar.lunarOn(selectedDate));
  const todayFestivals = festivalsOn(today);
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

  return (
    <View style={[styles.stage, desktopFrame && styles.desktopStage]}>
      <View style={[styles.phone, desktopFrame && styles.desktopPhone]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.appBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Ionicons name="calendar-outline" size={19} color={palette.clay} accessible={false} />
              </View>
              <Text accessibilityRole="header" style={styles.brandName}>
                岁岁日历
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="新增事项"
              style={({ pressed }) => [styles.addButton, pressed && styles.rowPressed]}
            >
              <Ionicons name="add" size={23} color={palette.surface} accessible={false} />
            </Pressable>
          </View>

          <View style={styles.todaySummary}>
            <View style={styles.todayCopy}>
              <Text style={styles.todayDate}>
                {shortDate(today)} {chineseWeekday(today)}
              </Text>
              <Text numberOfLines={1} style={styles.todayMeta}>
                农历{lunarLabel(lunarCalendar.lunarOn(today))}
                {todayFestivals.length ? ` · ${todayFestivals.join('、')}` : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="回到今天"
              onPress={returnToday}
              style={({ pressed }) => [styles.todayButton, pressed && styles.rowPressed]}
            >
              <Text style={styles.todayButtonText}>今天</Text>
            </Pressable>
          </View>

          <View style={styles.calendarSection}>
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
                  style={({ pressed }) => [styles.monthButton, pressed && styles.rowPressed]}
                >
                  <Ionicons name="chevron-back" size={20} color={palette.ink} accessible={false} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="下一个月"
                  accessibilityState={{ disabled: !canGoNext }}
                  disabled={!canGoNext}
                  onPress={() => changeMonth(1)}
                  style={({ pressed }) => [styles.monthButton, pressed && styles.rowPressed]}
                >
                  <Ionicons name="chevron-forward" size={20} color={palette.ink} accessible={false} />
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
                  />
                ))}
              </View>
            ))}

            <View style={styles.calendarLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.eventDot, styles.birthdayDot]} />
                <Text style={styles.legendText}>生日</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.eventDot, styles.memoryDot]} />
                <Text style={styles.legendText}>时光记</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`下一件事：${nearest.title}，${shortDate(nearest.date)}，${relativeLabel(nearest.date, today)}`}
              onPress={() => selectDate(nearest.date)}
              style={({ pressed }) => [styles.nextRow, pressed && styles.rowPressed]}
            >
              <View style={styles.nextAccent} />
              <EventThumb event={nearest} compact />
              <View style={styles.nextCopy}>
                <Text style={styles.nextLabel}>下一件事</Text>
                <Text numberOfLines={1} style={styles.nextTitle}>
                  {nearest.title}
                </Text>
              </View>
              <View style={styles.nextDateBlock}>
                <Text style={styles.nextDate}>{shortDate(nearest.date)}</Text>
                <Text style={styles.nextRelative}>{relativeLabel(nearest.date, today)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={palette.faint} accessible={false} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionLabel}>所选日期</Text>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {shortDate(selectedDate)}
                </Text>
              </View>
              <View style={styles.selectedMetaBlock}>
                <Text style={styles.selectedRelative}>{relativeLabel(selectedDate, today)}</Text>
                <Text style={styles.selectedLunar}>农历{selectedLunar}</Text>
              </View>
            </View>

            {selectedFestivals.map((festival) => (
              <View key={festival} style={[styles.detailRow, styles.rowDivider]}>
                <View style={styles.festivalIcon}>
                  <Ionicons name="flag-outline" size={19} color={palette.forest} accessible={false} />
                </View>
                <View style={styles.recordCopy}>
                  <Text style={styles.recordTitle}>{festival}</Text>
                  <Text style={styles.recordDetail}>节日与节气</Text>
                </View>
              </View>
            ))}

            {selectedEvent ? (
              <RecordRow event={selectedEvent} today={today} onPress={() => {}} divider={false} />
            ) : selectedFestivals.length === 0 ? (
              <Text style={styles.emptyText}>暂无生日或纪念日</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.listHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                近期重要日子
              </Text>
              <Text style={styles.recordCount}>{events.length} 条</Text>
            </View>
            {events.map((event, index) => (
              <RecordRow
                key={event.id}
                event={event}
                today={today}
                onPress={() => selectDate(event.date)}
                divider={index < events.length - 1}
              />
            ))}
          </View>
        </ScrollView>
        <BottomNavigation />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: palette.paper },
  desktopStage: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  phone: { flex: 1, position: 'relative', width: '100%', backgroundColor: palette.paper },
  desktopPhone: {
    maxHeight: 860,
    maxWidth: 420,
    borderColor: '#D2CFC7',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scrollContent: { paddingBottom: Platform.OS === 'web' ? 94 : 108 },
  appBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 8 : 34,
  },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  brandMark: {
    alignItems: 'center',
    backgroundColor: palette.claySoft,
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brandName: { color: palette.ink, fontSize: 19, fontWeight: '700', letterSpacing: 0.2 },
  addButton: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  todaySummary: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
    paddingBottom: 10,
    paddingHorizontal: 18,
  },
  todayCopy: { flex: 1, minWidth: 0 },
  todayDate: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  todayMeta: { color: palette.muted, fontSize: 13, marginTop: 4 },
  todayButton: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginLeft: 12,
    minHeight: 40,
    paddingHorizontal: 14,
  },
  todayButtonText: { color: palette.clay, fontSize: 13, fontWeight: '700' },
  calendarSection: {
    backgroundColor: palette.surface,
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingHorizontal: 12,
  },
  monthToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingLeft: 6,
  },
  monthTitle: { color: palette.ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  monthActions: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  monthButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 42 },
  weekRow: { flexDirection: 'row' },
  weekday: {
    color: palette.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 8,
    textAlign: 'center',
  },
  weekend: { color: palette.clay },
  dayCell: { alignItems: 'center', flex: 1, height: 62, paddingTop: 4 },
  dayCellPressed: { backgroundColor: '#F2EFE9', borderRadius: 12 },
  dayNumberWrap: { alignItems: 'center', height: 31, justifyContent: 'center', width: 31 },
  todayRing: { borderColor: palette.clay, borderRadius: 16, borderWidth: 1.5 },
  selectedDay: { backgroundColor: palette.clay, borderRadius: 16 },
  dayNumber: { color: palette.ink, fontSize: 16, fontWeight: '600' },
  todayNumber: { color: palette.clay, fontWeight: '700' },
  selectedDayText: { color: '#FFFFFF', fontWeight: '700' },
  dayHelper: { color: palette.muted, fontSize: 10, marginTop: 2, maxWidth: '96%' },
  festivalHelper: { color: palette.clay, fontWeight: '700' },
  selectedHelper: { color: palette.ink, fontWeight: '600' },
  markerRow: { alignItems: 'center', height: 7, justifyContent: 'flex-end', marginTop: 1 },
  eventDot: { borderRadius: 3, height: 5, width: 5 },
  birthdayDot: { backgroundColor: palette.clay },
  memoryDot: { backgroundColor: palette.forest },
  calendarLegend: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    minHeight: 30,
    paddingTop: 5,
  },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendText: { color: palette.muted, fontSize: 11 },
  nextRow: {
    alignItems: 'center',
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 6,
  },
  nextAccent: { backgroundColor: palette.forest, borderRadius: 2, height: 30, marginRight: 10, width: 3 },
  nextCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
  nextLabel: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  nextTitle: { color: palette.ink, fontSize: 15, fontWeight: '700', marginTop: 3 },
  nextDateBlock: { alignItems: 'flex-end', marginLeft: 8, marginRight: 4 },
  nextDate: { color: palette.ink, fontSize: 12, fontWeight: '600' },
  nextRelative: { color: palette.forest, fontSize: 11, fontWeight: '600', marginTop: 3 },
  eventThumb: {
    alignItems: 'center',
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  eventThumbCompact: { borderRadius: 10, height: 38, width: 38 },
  birthdayThumb: { backgroundColor: palette.claySoft },
  memoryThumb: { backgroundColor: palette.forestSoft },
  avatarText: { color: palette.clay, fontSize: 16, fontWeight: '700' },
  section: { paddingHorizontal: 18, paddingTop: 22 },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  sectionLabel: { color: palette.muted, fontSize: 12, fontWeight: '600', marginBottom: 3 },
  sectionTitle: { color: palette.ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  selectedMetaBlock: { alignItems: 'flex-end', paddingBottom: 1 },
  selectedRelative: { color: palette.clay, fontSize: 12, fontWeight: '700' },
  selectedLunar: { color: palette.muted, fontSize: 11, marginTop: 3 },
  detailRow: { alignItems: 'center', flexDirection: 'row', minHeight: 68 },
  festivalIcon: {
    alignItems: 'center',
    backgroundColor: palette.forestSoft,
    borderRadius: 11,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emptyText: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    color: palette.muted,
    fontSize: 14,
    paddingVertical: 18,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  recordCount: { color: palette.muted, fontSize: 12 },
  recordRow: { alignItems: 'center', flexDirection: 'row', minHeight: 74, paddingVertical: 12 },
  rowDivider: { borderBottomColor: palette.line, borderBottomWidth: 1 },
  recordCopy: { flex: 1, marginLeft: 12, minWidth: 0 },
  recordTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  recordDetail: { color: palette.muted, fontSize: 12, marginTop: 4 },
  recordDateBlock: { alignItems: 'flex-end', marginLeft: 8, marginRight: 5 },
  recordDate: { color: palette.ink, fontSize: 12, fontWeight: '600' },
  recordRelative: { color: palette.clay, fontSize: 11, fontWeight: '600', marginTop: 4 },
  bottomNavigation: {
    backgroundColor: palette.surface,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    height: Platform.OS === 'web' ? 72 : 86,
    left: 0,
    paddingBottom: Platform.OS === 'web' ? 4 : 15,
    position: 'absolute',
    right: 0,
  },
  navItem: { alignItems: 'center', flex: 1, justifyContent: 'center', position: 'relative' },
  navLabel: { color: palette.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  navLabelSelected: { color: palette.clay, fontWeight: '700' },
  navIndicator: {
    backgroundColor: palette.clay,
    borderRadius: 2,
    height: 3,
    position: 'absolute',
    top: 0,
    width: 24,
  },
  rowPressed: { opacity: 0.58 },
});
