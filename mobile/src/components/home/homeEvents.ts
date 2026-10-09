import {
  adjustmentText,
  birthdayAgeText,
  birthdayDates,
  birthdayTitle,
  upcoming,
  type Birthday,
  type BirthdayEntry,
} from '../../core/birthday';
import { lunarCalendar } from '../../core/calendar';
import { anniversaryDate, anniversaryProgress, timeNoteProgressText, type Countup } from '../../core/countup';
import { addDays, dayNumber } from '../../core/dates';
import { festivalsOn } from '../../core/festivals';

export type HomeEventKind = 'festival' | 'birthday' | 'memory';

export type HomeTimelineItem = {
  id: string;
  date: string;
  kind: HomeEventKind;
  title: string;
  detail: string;
  notes: string[];
  personId?: string;
  countupId?: string;
};

export function memoryItemsOn(date: string, countups: Countup[]): Countup[] {
  const year = Number(date.slice(0, 4));
  return countups.filter(
    (item) =>
      item.startDate === date ||
      (item.displayMode === 'anniversary' &&
        item.startDate < date &&
        anniversaryDate(item.startDate, year) === date),
  );
}

function birthdayItem(entry: BirthdayEntry): HomeTimelineItem {
  const age = birthdayAgeText(entry.person, entry.occurrence);
  const notes = [
    entry.occurrence.kinds.length === 2 ? '农历与阳历生日 · 同一天' : '',
    ...entry.occurrence.adjustments.map((code) => adjustmentText(code, entry.person.lunar?.month ?? 0)),
  ].filter(Boolean);
  return {
    id: `birthday-${entry.id}`,
    date: entry.occurrence.solar,
    kind: 'birthday',
    title: birthdayTitle(entry.person.name),
    detail: `${birthdayDates(entry.person, entry.occurrence.kinds)}${age ? ` · ${age}` : ''}`,
    notes,
    personId: entry.person.id,
  };
}

function memoryItem(item: Countup, date: string): HomeTimelineItem {
  return {
    id: `memory-${item.id}-${date}`,
    date,
    kind: 'memory',
    title: item.title,
    detail: `${item.displayMode === 'anniversary' ? '每年纪念' : '记录天数'} · ${timeNoteProgressText(item, date)}`,
    notes: item.note ? [item.note] : [],
    countupId: item.id,
  };
}

export function selectedTimelineItems(
  date: string,
  birthdayEntries: BirthdayEntry[],
  countups: Countup[],
): HomeTimelineItem[] {
  const festivalItems = festivalsOn(date).map<HomeTimelineItem>((title, index) => ({
    id: `festival-${date}-${index}`,
    date,
    kind: 'festival',
    title,
    detail: '节日与节气 · 全天',
    notes: [],
  }));
  const birthdays = birthdayEntries.filter((entry) => entry.occurrence.solar === date).map(birthdayItem);
  const memories = memoryItemsOn(date, countups).map((item) => memoryItem(item, date));
  return [...festivalItems, ...birthdays, ...memories];
}

function nextMemoryDate(item: Countup, from: string): string | null {
  if (item.startDate > from) return item.startDate;
  if (item.displayMode !== 'anniversary') return null;
  const progress = anniversaryProgress(item.startDate, from);
  return progress.phase === 'active' ? progress.nextDate : item.startDate;
}

export function upcomingTimelineItems(
  from: string,
  people: Birthday[],
  countups: Countup[],
  days = 30,
): HomeTimelineItem[] {
  const after = addDays(from, 1);
  const limit = dayNumber(from) + days;
  const items: HomeTimelineItem[] = [];

  for (let offset = 1; offset <= days; offset += 1) {
    const date = addDays(from, offset);
    festivalsOn(date).forEach((title, index) =>
      items.push({
        id: `festival-${date}-${index}`,
        date,
        kind: 'festival',
        title,
        detail: '节日与节气 · 全天',
        notes: [],
      }),
    );
  }

  for (const person of people) {
    const occurrence = upcoming(lunarCalendar, person, after)[0];
    if (!occurrence || dayNumber(occurrence.solar) > limit) continue;
    items.push(
      birthdayItem({
        id: `${person.id}-${occurrence.solar}`,
        person,
        occurrence,
      }),
    );
  }

  for (const item of countups) {
    const date = nextMemoryDate(item, from);
    if (!date || date <= from || dayNumber(date) > limit) continue;
    items.push(memoryItem(item, date));
  }

  const order: Record<HomeEventKind, number> = { festival: 0, birthday: 1, memory: 2 };
  return items.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      order[left.kind] - order[right.kind] ||
      left.id.localeCompare(right.id),
  );
}

export function todayReminderNames(items: HomeTimelineItem[]): string[] {
  return items
    .filter((item) => item.kind === 'festival' || item.kind === 'birthday')
    .map((item) => item.title);
}
