import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateCalculatorDialog } from '../src/components/DateCalculatorDialog';
import { HomeBottomNavigation } from '../src/components/home/HomeBottomNavigation';
import { HomeCalendarTimeline } from '../src/components/home/HomeCalendarTimeline';
import { BirthdayBook, CountupBook } from '../src/components/home/HomeRecordList';
import type { HomeSection } from '../src/components/home/homeNavigation';
import { defaultHomeTheme, type HomeTheme } from '../src/components/home/homeTheme';
import { MonthCalendar } from '../src/components/MonthCalendar';
import { Icon } from '../src/components/ui';
import { entriesForMonth } from '../src/core/birthday';
import { lunarCalendar, lunarLabel } from '../src/core/calendar';
import { chineseFullDate, monthStart, supported } from '../src/core/dates';
import { storageDescription } from '../src/data/repository';
import { useBirthdays } from '../src/state/AppProvider';
import { useAuth } from '../src/state/AuthProvider';

type HomeTab = HomeSection;
const PHONE_PREVIEW_WIDTH = 443;
const theme = defaultHomeTheme;
const styles = createStyles(theme);

const tabTitle: Record<HomeTab, string> = {
  calendar: '我的日历',
  book: '生日簿',
  countup: '时光记',
};

export function homeLayoutWidth(width: number, platform: string, search: string) {
  if (platform !== 'web') return width;
  const params = new URLSearchParams(search);
  if (params.get('preview') !== 'phone') return width;
  const requested = Number(params.get('previewWidth'));
  return [320, 390, PHONE_PREVIEW_WIDTH].includes(requested) ? requested : PHONE_PREVIEW_WIDTH;
}

export function homeTabFromParam(value: string | string[] | undefined): HomeTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === 'book' || candidate === 'countup' ? candidate : 'calendar';
}

export function accountInitial(email: string | undefined): string {
  return email ? (Array.from(email.trim())[0]?.toUpperCase() ?? '') : '';
}

function AppHeader({ tab, email, onAccount }: { tab: HomeTab; email?: string; onAccount: () => void }) {
  const initial = accountInitial(email);
  return (
    <View style={styles.appBar}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Icon name="calendar" size={18} color={theme.colors.accent} />
        </View>
        <View>
          <Text style={styles.brandName}>岁岁日历</Text>
          <Text accessibilityRole={tab === 'calendar' ? 'header' : undefined} style={styles.sectionName}>
            {tabTitle[tab]}
          </Text>
        </View>
      </View>
      <Pressable
        testID="首页账号入口"
        accessibilityRole="button"
        accessibilityLabel={email ? `账号：${email}` : '我的账号'}
        accessibilityHint="打开账号与同步"
        onPress={onAccount}
        style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
      >
        {initial ? (
          <Text style={styles.accountInitial}>{initial}</Text>
        ) : (
          <Icon name="person-outline" size={20} color={theme.colors.textSecondary} />
        )}
      </Pressable>
    </View>
  );
}

function DateSummary({ today, onCalculate }: { today: string; onCalculate: () => void }) {
  const lunar = supported(today) ? lunarCalendar.lunarOn(today) : null;
  const lunarText = lunar ? `农历${lunarLabel(lunar)}` : '设备日期超出历法支持范围';
  return (
    <View testID="日历次级工具栏" style={styles.dateSummary}>
      <View style={styles.dateSummaryTop}>
        <Text
          accessibilityLabel={`今天，${chineseFullDate(today)}，${lunarText}，北京时间`}
          style={styles.todayDate}
        >
          今天 {chineseFullDate(today)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="日期计算"
          onPress={onCalculate}
          style={({ pressed }) => [styles.calculatorButton, pressed && styles.pressed]}
        >
          <Icon name="calculator-outline" size={15} color={theme.colors.textSecondary} />
          <Text style={styles.calculatorButtonText}>日期计算</Text>
        </Pressable>
      </View>
      <Text style={styles.todayLunar}>{lunarText} · 北京时间</Text>
    </View>
  );
}

export default function Home() {
  const state = useBirthdays();
  const auth = useAuth();
  const params = useLocalSearchParams<{ tab?: string | string[]; tool?: string | string[] }>();
  const { width } = useWindowDimensions();
  const previewSearch = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.search : '';
  const layoutWidth = homeLayoutWidth(width, Platform.OS, previewSearch);
  const phonePreview = layoutWidth !== width;
  const shellWidth = phonePreview ? layoutWidth : width >= 700 ? theme.size.homeCanvas : layoutWidth;
  const [tab, setTab] = useState<HomeTab>(() => homeTabFromParam(params.tab));
  const [calculatingDate, setCalculatingDate] = useState(
    () => (Array.isArray(params.tool) ? params.tool[0] : params.tool) === 'calculator',
  );

  useFocusEffect(state.refreshToday);
  const entries = useMemo(
    () => entriesForMonth(lunarCalendar, state.people, state.month),
    [state.month, state.people],
  );
  const todayEntries = useMemo(
    () => entriesForMonth(lunarCalendar, state.people, monthStart(state.today)),
    [state.people, state.today],
  );
  const orderedCountups = useMemo(() => state.countupRows.map(({ item }) => item), [state.countupRows]);

  const create = () => router.push('/new');
  const openBirthday = (id: string) => router.push({ pathname: '/birthday/[id]', params: { id } });
  const openMemory = (id: string) => router.push({ pathname: '/countup/[id]', params: { id } });
  const selectTab = (next: HomeTab) => {
    setTab(next);
    state.refreshToday();
  };
  const returnToday = () => {
    setTab('calendar');
    state.selectDate(state.today);
    state.refreshToday();
  };
  const accountParams = {
    section: 'account',
    ...(phonePreview ? { preview: 'phone' } : {}),
  };
  const openAccount = () => router.push({ pathname: '/account', params: accountParams });

  return (
    <SafeAreaView style={styles.stage}>
      <View style={[styles.shell, { maxWidth: shellWidth }]}>
        <AppHeader tab={tab} email={auth.session?.email} onAccount={openAccount} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {state.notice ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭提示"
              onPress={() => state.setNotice('')}
              style={({ pressed }) => [styles.notice, pressed && styles.pressed]}
            >
              <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
                {state.notice}
              </Text>
              <Icon name="close" size={16} color={theme.colors.success} />
            </Pressable>
          ) : null}

          {state.status === 'loading' ? (
            <View style={styles.feedback}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.feedbackText}>正在读取事项…</Text>
            </View>
          ) : state.status === 'error' ? (
            <View style={styles.feedback}>
              <Text style={styles.feedbackTitle}>暂时无法读取事项</Text>
              <Text accessibilityRole="alert" style={styles.errorText}>
                {state.error}
              </Text>
              <Text style={styles.feedbackText}>现有数据不会被重置，请检查设备存储后重试。</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="重新读取"
                onPress={() => void state.reload()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>重新读取</Text>
              </Pressable>
            </View>
          ) : tab === 'calendar' ? (
            <View testID="正式日历首页">
              <DateSummary today={state.today} onCalculate={() => setCalculatingDate(true)} />
              <View testID="月历事项一体区">
                <MonthCalendar
                  month={state.month}
                  today={state.today}
                  selected={state.selectedDate}
                  entries={entries}
                  countups={state.countups}
                  onSelect={state.selectDate}
                  onMonth={state.viewMonth}
                  onToday={returnToday}
                  compact
                  showTodayAction
                  theme={theme}
                />
                <HomeCalendarTimeline
                  selectedDate={state.selectedDate}
                  today={state.today}
                  birthdayEntries={entries}
                  todayBirthdayEntries={todayEntries}
                  people={state.people}
                  countups={state.countups}
                  onCreate={create}
                  onOpenBirthday={openBirthday}
                  onOpenMemory={openMemory}
                  theme={theme}
                />
              </View>
            </View>
          ) : tab === 'book' ? (
            <BirthdayBook rows={state.rows} onCreate={create} onOpen={openBirthday} theme={theme} />
          ) : (
            <CountupBook
              items={orderedCountups}
              today={state.today}
              onCreate={create}
              onOpen={openMemory}
              theme={theme}
            />
          )}

          {state.status === 'ready' && tab !== 'calendar' ? (
            <View style={styles.storageNote}>
              <Icon name="lock-closed-outline" size={13} color={theme.colors.textSecondary} />
              <Text style={styles.storageText}>{storageDescription} 系统提醒可在“我的”中设置。</Text>
            </View>
          ) : null}
        </ScrollView>

        {state.status === 'ready' && tab === 'calendar' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`在 ${state.selectedDate} 新建事项`}
            onPress={create}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Icon name="add" size={27} color={theme.colors.selectedText} />
          </Pressable>
        ) : null}

        <HomeBottomNavigation
          active={tab}
          birthdayCount={state.people.length}
          countupCount={state.countups.length}
          onSelect={selectTab}
          onAccount={openAccount}
          theme={theme}
        />
      </View>

      {calculatingDate ? (
        <DateCalculatorDialog today={state.today} onClose={() => setCalculatingDate(false)} />
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(homeTheme: HomeTheme) {
  const { colors, typography, spacing, radius, size } = homeTheme;
  return StyleSheet.create({
    stage: { alignItems: 'center', backgroundColor: colors.backdrop, flex: 1 },
    shell: {
      backgroundColor: colors.surface,
      flex: 1,
      position: 'relative',
      width: '100%',
    },
    appBar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 58,
      paddingHorizontal: spacing.md,
    },
    brandRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    brandMark: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: radius.sm,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    brandName: { color: colors.textPrimary, fontSize: typography.appTitle, fontWeight: typography.bold },
    sectionName: { color: colors.textSecondary, fontSize: typography.caption, marginTop: 1 },
    accountButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.round,
      height: size.iconButton,
      justifyContent: 'center',
      width: size.iconButton,
    },
    accountInitial: {
      color: colors.accent,
      fontSize: typography.body,
      fontWeight: typography.bold,
    },
    calculatorButton: {
      alignItems: 'center',
      borderRadius: radius.sm,
      flexDirection: 'row',
      gap: spacing.xxs,
      minHeight: 32,
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
    },
    calculatorButtonText: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      fontWeight: typography.semibold,
    },
    scroll: { flex: 1 },
    scrollContent: {
      backgroundColor: colors.surface,
      paddingBottom: size.addButton + spacing.xl,
    },
    dateSummary: {
      backgroundColor: colors.surfaceMuted,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      gap: 1,
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    dateSummaryTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minWidth: 0,
    },
    todayDate: { color: colors.textPrimary, fontSize: typography.label, fontWeight: typography.semibold },
    todayLunar: { color: colors.textSecondary, fontSize: typography.caption },
    notice: {
      alignItems: 'center',
      backgroundColor: colors.memorySoft,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    noticeText: { color: colors.success, flex: 1, fontSize: typography.label },
    feedback: {
      alignItems: 'center',
      gap: spacing.md,
      justifyContent: 'center',
      minHeight: 320,
      padding: spacing.xl,
    },
    feedbackTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.semibold },
    feedbackText: { color: colors.textSecondary, fontSize: typography.label, textAlign: 'center' },
    errorText: { color: colors.error, fontSize: typography.label, textAlign: 'center' },
    retryButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      minHeight: 42,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    retryText: { color: colors.selectedText, fontSize: typography.label, fontWeight: typography.semibold },
    storageNote: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.xs,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
    },
    storageText: {
      color: colors.textSecondary,
      flexShrink: 1,
      fontSize: typography.caption,
      lineHeight: 16,
    },
    addButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderColor: colors.surface,
      borderRadius: radius.round,
      borderWidth: 3,
      bottom: size.bottomNavigation + spacing.md,
      height: size.addButton,
      justifyContent: 'center',
      position: 'absolute',
      right: spacing.lg,
      width: size.addButton,
    },
    addButtonPressed: { backgroundColor: colors.selected },
    pressed: { backgroundColor: colors.pressed },
  });
}
