import {
  birthdayDates,
  birthdayAgeText,
  birthdayTitle,
  upcoming,
  type Birthday,
  type BirthdayKind,
  type Occurrence,
} from './birthday';
import type { LunarCalendar } from './calendar';
import { anniversaryDate, type Countup } from './countup';
import { addDays, LAST_DATE, todayInBeijing } from './dates';
import { festivalsOn } from './festivals';

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  enabled: false,
  fullScreenEnabled: false,
  hour: 9,
  minute: 0,
});
export const MAX_SCHEDULED_REMINDERS = 60;

export type NotificationSettings = {
  enabled: boolean;
  fullScreenEnabled: boolean;
  hour: number;
  minute: number;
};

export type ReminderKind = 'birthday' | 'anniversary' | 'festival' | 'combined';

export type ScheduledReminder = {
  identifier: string;
  kind: ReminderKind;
  itemId: string;
  date: string;
  triggerAt: number;
  title: string;
  body: string;
};

function integerInRange(value: unknown, from: number, to: number): value is number {
  return Number.isInteger(value) && Number(value) >= from && Number(value) <= to;
}

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const input = value as Record<string, unknown>;
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_NOTIFICATION_SETTINGS.enabled,
    fullScreenEnabled:
      typeof input.fullScreenEnabled === 'boolean'
        ? input.fullScreenEnabled
        : DEFAULT_NOTIFICATION_SETTINGS.fullScreenEnabled,
    hour: integerInRange(input.hour, 0, 23) ? Number(input.hour) : DEFAULT_NOTIFICATION_SETTINGS.hour,
    minute: integerInRange(input.minute, 0, 59) ? Number(input.minute) : DEFAULT_NOTIFICATION_SETTINGS.minute,
  };
}

export function notificationTimeText(settings: Pick<NotificationSettings, 'hour' | 'minute'>): string {
  return `${String(settings.hour).padStart(2, '0')}:${String(settings.minute).padStart(2, '0')}`;
}

export function beijingTriggerAt(
  date: string,
  settings: Pick<NotificationSettings, 'hour' | 'minute'>,
): number {
  return Date.parse(
    `${date}T${String(settings.hour).padStart(2, '0')}:${String(settings.minute).padStart(2, '0')}:00+08:00`,
  );
}

function futureBirthdayOccurrences(
  calendar: LunarCalendar,
  person: Birthday,
  kind: BirthdayKind,
  today: string,
  now: number,
  settings: NotificationSettings,
): Occurrence[] {
  const single = {
    name: person.name,
    lunar: kind === 'lunar' ? person.lunar : null,
    solar: kind === 'solar' ? person.solar : null,
    birthYear: person.birthYear,
  };
  if (!single.lunar && !single.solar) return [];
  return upcoming(calendar, single, today, MAX_SCHEDULED_REMINDERS + 1)
    .filter((occurrence) => beijingTriggerAt(occurrence.solar, settings) > now)
    .slice(0, MAX_SCHEDULED_REMINDERS);
}

function mergeBirthdayOccurrences(values: Occurrence[]): Occurrence[] {
  const merged = new Map<string, Occurrence>();
  for (const value of values) {
    const previous = merged.get(value.solar);
    if (!previous) {
      merged.set(value.solar, value);
      continue;
    }
    merged.set(value.solar, {
      solar: value.solar,
      kinds: ['lunar', 'solar'],
      lunar: previous.lunar ?? value.lunar,
      adjustments: [...previous.adjustments, ...value.adjustments],
    });
  }
  return [...merged.values()].sort((a, b) => a.solar.localeCompare(b.solar));
}

function birthdayReminders(
  calendar: LunarCalendar,
  person: Birthday,
  today: string,
  now: number,
  settings: NotificationSettings,
): ScheduledReminder[] {
  const occurrences = mergeBirthdayOccurrences(
    (['lunar', 'solar'] as const).flatMap((kind) =>
      futureBirthdayOccurrences(calendar, person, kind, today, now, settings),
    ),
  );
  return occurrences.map((occurrence) => ({
    identifier: `suisui-birthday-${person.id}-${occurrence.solar}`,
    kind: 'birthday',
    itemId: person.id,
    date: occurrence.solar,
    triggerAt: beijingTriggerAt(occurrence.solar, settings),
    title: `今天是${birthdayTitle(person.name)}${
      birthdayAgeText(person, occurrence) ? `，${birthdayAgeText(person, occurrence)}` : ''
    }`,
    body: `${birthdayDates(person, occurrence.kinds)} · 记得送上一句祝福。`,
  }));
}

function anniversaryReminders(
  item: Countup,
  today: string,
  now: number,
  settings: NotificationSettings,
): ScheduledReminder[] {
  if (item.displayMode !== 'anniversary') return [];
  const startYear = Number(item.startDate.slice(0, 4));
  let year = Math.max(Number(today.slice(0, 4)), startYear + 1);
  const reminders: ScheduledReminder[] = [];
  while (year <= 2100 && reminders.length < MAX_SCHEDULED_REMINDERS) {
    const date = anniversaryDate(item.startDate, year);
    if (date && beijingTriggerAt(date, settings) > now) {
      const years = year - startYear;
      reminders.push({
        identifier: `suisui-anniversary-${item.id}-${date}`,
        kind: 'anniversary',
        itemId: item.id,
        date,
        triggerAt: beijingTriggerAt(date, settings),
        title: `今天是「${item.title}」${years} 周年`,
        body: `从 ${item.startDate.replaceAll('-', '.')} 开始，值得纪念的一天。`,
      });
    }
    year += 1;
  }
  return reminders;
}

function festivalReminders(today: string, now: number, settings: NotificationSettings): ScheduledReminder[] {
  const reminders: ScheduledReminder[] = [];
  let date = today;
  while (date <= LAST_DATE && reminders.length < MAX_SCHEDULED_REMINDERS) {
    const triggerAt = beijingTriggerAt(date, settings);
    if (triggerAt > now) {
      const names = festivalsOn(date);
      if (names.length > 0) {
        reminders.push({
          identifier: `suisui-festival-${date}`,
          kind: 'festival',
          itemId: date,
          date,
          triggerAt,
          title: `今天是${names.join('、')}`,
          body: '日历上的重要日子，愿今天有值得记住的时刻。',
        });
      }
    }
    if (date === LAST_DATE) break;
    date = addDays(date, 1);
  }
  return reminders;
}

function reminderSubject(reminder: ScheduledReminder): string {
  return reminder.title.startsWith('今天是') ? reminder.title.slice(3) : reminder.title;
}

function mergeRemindersOnSameDate(reminders: ScheduledReminder[]): ScheduledReminder[] {
  const grouped = new Map<string, ScheduledReminder[]>();
  for (const reminder of reminders) {
    const values = grouped.get(reminder.date) ?? [];
    values.push(reminder);
    grouped.set(reminder.date, values);
  }
  return [...grouped.entries()].map(([date, values]) => {
    if (values.length === 1) return values[0];
    return {
      identifier: `suisui-combined-${date}`,
      kind: 'combined',
      itemId: date,
      date,
      triggerAt: values[0].triggerAt,
      title: '今天有多个重要日子',
      body: `${values.map(reminderSubject).join('、')}。都值得好好记住。`,
    };
  });
}

export function buildNotificationPlan({
  calendar,
  people,
  countups,
  now,
  settings,
}: {
  calendar: LunarCalendar;
  people: Birthday[];
  countups: Countup[];
  now: number;
  settings: NotificationSettings;
}): ScheduledReminder[] {
  if (!settings.enabled) return [];
  const today = todayInBeijing(now);
  return mergeRemindersOnSameDate([
    ...festivalReminders(today, now, settings),
    ...people.flatMap((person) => birthdayReminders(calendar, person, today, now, settings)),
    ...countups.flatMap((item) => anniversaryReminders(item, today, now, settings)),
  ])
    .sort((a, b) => a.triggerAt - b.triggerAt || a.identifier.localeCompare(b.identifier))
    .slice(0, MAX_SCHEDULED_REMINDERS);
}
