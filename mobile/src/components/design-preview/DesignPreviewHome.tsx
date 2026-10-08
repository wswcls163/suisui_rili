import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { lunarCalendar, lunarLabel } from '../../core/calendar';
import {
  addDays,
  chineseFullDate,
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
  note: string;
  kind: 'birthday' | 'memory';
  tone: 'clay' | 'forest' | 'sand';
};

type DesignPreviewHomeProps = {
  today: string;
};

const palette = {
  canvas: '#E8E5DE',
  paper: '#F8F6F1',
  surface: '#FEFDF9',
  ink: '#202827',
  muted: '#747A76',
  faint: '#A7AAA5',
  line: '#E4E1D9',
  clay: '#B4523D',
  claySoft: '#F1DED6',
  forest: '#4D6859',
  forestSoft: '#DDE7DF',
  sand: '#B9874D',
  sandSoft: '#EFE3D2',
};

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

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
  if (distance === 0) return '就是今天';
  if (distance === 1) return '明天';
  if (distance > 1) return `${distance} 天后`;
  return `${Math.abs(distance)} 天前`;
}

function createPreviewEvents(today: string): PreviewEvent[] {
  return [
    {
      id: 'mother-birthday',
      date: addDays(today, 4),
      title: '妈妈的生日',
      note: '准备一束她喜欢的花',
      kind: 'birthday',
      tone: 'clay',
    },
    {
      id: 'travel-memory',
      date: addDays(today, 10),
      title: '一起旅行纪念',
      note: '青岛海边 · 第 3 年',
      kind: 'memory',
      tone: 'forest',
    },
    {
      id: 'friend-birthday',
      date: addDays(today, 17),
      title: '阿宁的生日',
      note: '别忘了提前约晚餐',
      kind: 'birthday',
      tone: 'sand',
    },
  ];
}

function eventIcon(kind: PreviewEvent['kind']): keyof typeof Ionicons.glyphMap {
  return kind === 'birthday' ? 'gift-outline' : 'images-outline';
}

function PhotoPlaceholder({ event }: { event: PreviewEvent }) {
  const backgroundColor =
    event.tone === 'forest'
      ? palette.forestSoft
      : event.tone === 'sand'
        ? palette.sandSoft
        : palette.claySoft;
  const color =
    event.tone === 'forest' ? palette.forest : event.tone === 'sand' ? palette.sand : palette.clay;
  return (
    <View
      accessibilityLabel={`${event.title}照片占位`}
      style={[styles.photoPlaceholder, { backgroundColor }]}
    >
      <Ionicons name={eventIcon(event.kind)} size={22} color={color} accessible={false} />
      <Text style={[styles.photoPlaceholderText, { color }]}>照片</Text>
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
      style={({ pressed }) => [styles.dayCell, pressed && styles.pressedDay]}
    >
      <View style={[styles.dayNumberWrap, isToday && styles.todayRing, selected && styles.selectedDay]}>
        <Text style={[styles.dayNumber, selected && styles.selectedDayText]}>{day}</Text>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.dayHelper, festival && styles.festivalHelper, selected && styles.selectedHelper]}
      >
        {helper}
      </Text>
      <View style={styles.markerRow}>
        {event ? (
          <View
            accessibilityLabel={event.kind === 'birthday' ? '有生日' : '有时光记录'}
            style={[
              styles.eventDot,
              { backgroundColor: event.kind === 'birthday' ? palette.clay : palette.forest },
            ]}
          />
        ) : null}
      </View>
    </Pressable>
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
          <View style={styles.topBar}>
            <View>
              <Text style={styles.eyebrow}>岁岁日历</Text>
              <Text accessibilityRole="header" style={styles.todayTitle}>
                今天
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="回到今天"
              onPress={returnToday}
              style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
            >
              <Ionicons name="locate-outline" size={17} color={palette.ink} accessible={false} />
              <Text style={styles.todayButtonText}>回到今天</Text>
            </Pressable>
          </View>

          <Text style={styles.fullDate}>{chineseFullDate(today)}</Text>
          <Text style={styles.lunarToday}>农历{lunarLabel(lunarCalendar.lunarOn(today))} · 北京时间</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`最近的重要日子：${nearest.title}，${relativeLabel(nearest.date, today)}`}
            onPress={() => selectDate(nearest.date)}
            style={({ pressed }) => [styles.nextEvent, pressed && styles.pressed]}
          >
            <View style={styles.nextEventDate}>
              <Text style={styles.nextEventDay}>{Number(nearest.date.slice(8))}</Text>
              <Text style={styles.nextEventMonth}>{Number(nearest.date.slice(5, 7))} 月</Text>
            </View>
            <View style={styles.nextEventCopy}>
              <Text style={styles.nextEventLabel}>最近的重要日子</Text>
              <Text numberOfLines={1} style={styles.nextEventTitle}>
                {nearest.title}
              </Text>
            </View>
            <View style={styles.nextEventDistance}>
              <Text style={styles.nextEventDistanceText}>{relativeLabel(nearest.date, today)}</Text>
              <Ionicons name="chevron-forward" size={17} color="#E5EFE8" accessible={false} />
            </View>
          </Pressable>

          <View style={styles.calendarSection}>
            <View style={styles.monthToolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="上一个月"
                accessibilityState={{ disabled: !canGoPrevious }}
                disabled={!canGoPrevious}
                onPress={() => changeMonth(-1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={20} color={palette.ink} accessible={false} />
              </Pressable>
              <Text accessibilityRole="header" style={styles.monthTitle}>
                {monthTitle(visibleMonth)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="下一个月"
                accessibilityState={{ disabled: !canGoNext }}
                disabled={!canGoNext}
                onPress={() => changeMonth(1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-forward" size={20} color={palette.ink} accessible={false} />
              </Pressable>
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

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.eventDot, { backgroundColor: palette.clay }]} />
                <Text style={styles.legendText}>生日</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.eventDot, { backgroundColor: palette.forest }]} />
                <Text style={styles.legendText}>时光记录</Text>
              </View>
            </View>
          </View>

          <View style={styles.selectedSection}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionKicker}>所选日期</Text>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {shortDate(selectedDate)}
                </Text>
              </View>
              <Text style={styles.selectedRelative}>{relativeLabel(selectedDate, today)}</Text>
            </View>
            <Text style={styles.selectedMeta}>
              农历{selectedLunar}
              {selectedFestivals.length ? ` · ${selectedFestivals.join('、')}` : ''}
            </Text>
            {selectedEvent ? (
              <View style={styles.selectedEventRow}>
                <PhotoPlaceholder event={selectedEvent} />
                <View style={styles.selectedEventCopy}>
                  <Text style={styles.selectedEventTitle}>{selectedEvent.title}</Text>
                  <Text style={styles.selectedEventNote}>{selectedEvent.note}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>这一天没有额外记录，留一点空白也很好。</Text>
            )}
          </View>

          <View style={styles.recentSection}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionKicker}>接下来</Text>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  近期重要日子
                </Text>
              </View>
              <Text style={styles.recordCount}>{events.length} 条</Text>
            </View>
            {events.map((event, index) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={`${event.title}，${shortDate(event.date)}，${relativeLabel(event.date, today)}`}
                onPress={() => selectDate(event.date)}
                style={({ pressed }) => [
                  styles.recordRow,
                  index < events.length - 1 && styles.recordDivider,
                  pressed && styles.pressed,
                ]}
              >
                <PhotoPlaceholder event={event} />
                <View style={styles.recordCopy}>
                  <Text numberOfLines={1} style={styles.recordTitle}>
                    {event.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.recordNote}>
                    {event.note}
                  </Text>
                </View>
                <View style={styles.recordDateBlock}>
                  <Text style={styles.recordDate}>{shortDate(event.date)}</Text>
                  <Text style={styles.recordRelative}>{relativeLabel(event.date, today)}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={styles.previewNote}>独立视觉预览 · 使用示例内容，不会写入你的日历</Text>
        </ScrollView>
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
    paddingVertical: 30,
  },
  phone: { flex: 1, width: '100%', backgroundColor: palette.paper },
  desktopPhone: {
    maxWidth: 430,
    borderColor: '#D5D1C8',
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scrollContent: { paddingBottom: 32 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'web' ? 24 : 52,
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 2,
  },
  todayTitle: { color: palette.ink, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  todayButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 2,
  },
  todayButtonText: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  fullDate: { color: palette.ink, fontSize: 15, fontWeight: '500', marginLeft: 22, marginTop: 12 },
  lunarToday: { color: palette.muted, fontSize: 13, marginLeft: 22, marginTop: 4 },
  nextEvent: {
    alignItems: 'center',
    backgroundColor: palette.forest,
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    minHeight: 92,
    paddingHorizontal: 16,
  },
  nextEventDate: {
    alignItems: 'center',
    borderRightColor: 'rgba(255,255,255,0.26)',
    borderRightWidth: 1,
    paddingRight: 15,
  },
  nextEventDay: { color: '#FFFDF8', fontSize: 28, fontWeight: '700', lineHeight: 31 },
  nextEventMonth: { color: '#E5EFE8', fontSize: 11, marginTop: 1 },
  nextEventCopy: { flex: 1, paddingHorizontal: 15 },
  nextEventLabel: { color: '#C9D9CE', fontSize: 11, fontWeight: '600', marginBottom: 5 },
  nextEventTitle: { color: '#FFFDF8', fontSize: 18, fontWeight: '700' },
  nextEventDistance: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  nextEventDistanceText: { color: '#FFFDF8', fontSize: 12, fontWeight: '600' },
  calendarSection: {
    backgroundColor: palette.surface,
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    marginTop: 18,
    paddingBottom: 13,
    paddingHorizontal: 12,
  },
  monthToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 2,
  },
  monthButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  monthTitle: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekday: {
    color: palette.muted,
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    paddingBottom: 7,
    textAlign: 'center',
  },
  weekend: { color: palette.clay },
  dayCell: { alignItems: 'center', flex: 1, height: 58, paddingTop: 3 },
  pressedDay: { opacity: 0.56 },
  dayNumberWrap: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  todayRing: { borderColor: palette.clay, borderRadius: 14, borderWidth: 1 },
  selectedDay: { backgroundColor: palette.clay, borderColor: palette.clay, borderRadius: 14 },
  dayNumber: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  selectedDayText: { color: '#FFFFFF' },
  dayHelper: { color: palette.faint, fontSize: 9, marginTop: 2, maxWidth: '96%' },
  festivalHelper: { color: palette.clay, fontWeight: '600' },
  selectedHelper: { color: palette.clay },
  markerRow: { height: 6, justifyContent: 'flex-end', marginTop: 2 },
  eventDot: { borderRadius: 3, height: 5, width: 5 },
  legend: { flexDirection: 'row', gap: 18, justifyContent: 'center', paddingTop: 7 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendText: { color: palette.muted, fontSize: 10 },
  selectedSection: { paddingHorizontal: 22, paddingTop: 23 },
  sectionHeadingRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  sectionKicker: { color: palette.muted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  sectionTitle: { color: palette.ink, fontSize: 21, fontWeight: '700', letterSpacing: -0.3 },
  selectedRelative: { color: palette.clay, fontSize: 13, fontWeight: '600', paddingBottom: 2 },
  selectedMeta: { color: palette.muted, fontSize: 12, marginTop: 7 },
  selectedEventRow: {
    alignItems: 'center',
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 16,
  },
  selectedEventCopy: { flex: 1, marginLeft: 13 },
  selectedEventTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  selectedEventNote: { color: palette.muted, fontSize: 12, marginTop: 5 },
  emptyText: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 21,
    paddingVertical: 16,
  },
  photoPlaceholder: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  photoPlaceholderText: { fontSize: 8, fontWeight: '600', marginTop: 1 },
  recentSection: { paddingHorizontal: 22, paddingTop: 25 },
  recordCount: { color: palette.muted, fontSize: 12, paddingBottom: 2 },
  recordRow: { alignItems: 'center', flexDirection: 'row', minHeight: 82, paddingVertical: 13 },
  recordDivider: { borderBottomColor: palette.line, borderBottomWidth: 1 },
  recordCopy: { flex: 1, marginLeft: 13, minWidth: 0 },
  recordTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  recordNote: { color: palette.muted, fontSize: 11, marginTop: 5 },
  recordDateBlock: { alignItems: 'flex-end', marginLeft: 8 },
  recordDate: { color: palette.ink, fontSize: 12, fontWeight: '600' },
  recordRelative: { color: palette.clay, fontSize: 10, marginTop: 5 },
  previewNote: {
    color: palette.faint,
    fontSize: 10,
    marginHorizontal: 22,
    marginTop: 20,
    textAlign: 'center',
  },
  pressed: { opacity: 0.66 },
});
