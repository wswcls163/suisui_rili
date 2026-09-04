'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ComponentProps } from 'react';
import { zhCN } from 'date-fns/locale';
import {
  CalendarDays,
  Cake,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { daysUntil, lunarLabel, lunarOnDate } from '@/lib/birthday/calendar';
import {
  entriesForMonth,
  FIRST_DEMO_DATE,
  LAST_DEMO_DATE,
  isSupportedMonth,
  lunarCellLabel,
  monthStart,
  pickerDate,
  pickerIso,
  shiftMonth,
} from '@/lib/birthday/calendar-view';
import type { BirthdayEntry } from '@/lib/birthday/calendar-view';
import type { Person } from '@/lib/birthday/demo-state';

const EntryContext = createContext<Map<string, BirthdayEntry[]>>(new Map());

function LunarDayButton(props: ComponentProps<typeof CalendarDayButton>) {
  const entries = useContext(EntryContext);
  const iso = pickerIso(props.day.date);
  const dayEntries = entries.get(iso) ?? [];
  return (
    <CalendarDayButton
      {...props}
      className="month-day-button"
      aria-label={`${iso}，农历${lunarCellLabel(iso)}${dayEntries.length ? `，${dayEntries.length} 位生日：${dayEntries.map((item) => item.person.name).join('、')}` : ''}`}
    >
      <span className="solar-day">{props.day.date.getDate()}</span>
      <span className="lunar-day">{lunarCellLabel(iso)}</span>
      {dayEntries.length > 0 && (
        <span className="calendar-event">
          <span className="event-dot" />
          <span className="calendar-event-name">
            {dayEntries[0].person.name}
            {dayEntries.length > 1 ? ` +${dayEntries.length - 1}` : ''}
          </span>
        </span>
      )}
    </CalendarDayButton>
  );
}

type Props = {
  people: Person[];
  today: string;
  selectedDate: string;
  displayMonth: string;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
  onCreate: () => void;
  onOpenPerson: (person: Person) => void;
};
export function MonthCalendar({
  people,
  today,
  selectedDate,
  displayMonth,
  onSelect,
  onMonthChange,
  onCreate,
  onOpenPerson,
}: Props) {
  const entries = useMemo(
    () => entriesForMonth(people, displayMonth),
    [people, displayMonth],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, BirthdayEntry[]>();
    for (const entry of entries)
      map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
    return map;
  }, [entries]);
  const selectedEntries = byDate.get(selectedDate) ?? [];
  const selectedLunar = lunarOnDate(selectedDate);
  const delta = daysUntil(selectedDate, today);
  const relative =
    delta === 0 ? '今天' : delta > 0 ? `${delta} 天后` : `${-delta} 天前`;
  return (
    <div className="calendar-workspace">
      <section className="month-card" aria-label="月历">
        <div className="month-toolbar">
          <div>
            <p className="eyebrow">LUNAR CALENDAR</p>
            <h2>
              {Number(displayMonth.slice(0, 4))} 年{' '}
              {Number(displayMonth.slice(5, 7))} 月
            </h2>
          </div>
          <div className="month-navigation">
            <Button
              variant="ghost"
              size="icon"
              aria-label="上个月"
              disabled={!isSupportedMonth(shiftMonth(displayMonth, -1))}
              onClick={() => onMonthChange(shiftMonth(displayMonth, -1))}
            >
              <ChevronLeft size={19} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="下个月"
              disabled={!isSupportedMonth(shiftMonth(displayMonth, 1))}
              onClick={() => onMonthChange(shiftMonth(displayMonth, 1))}
            >
              <ChevronRight size={19} />
            </Button>
            <Button
              variant="outline"
              className="button-secondary return-today"
              onClick={() => onSelect(today)}
            >
              回到今天
            </Button>
          </div>
        </div>
        <EntryContext.Provider value={byDate}>
          <Calendar
            className="full-month-calendar"
            mode="single"
            required
            hideNavigation
            selected={pickerDate(selectedDate)}
            month={pickerDate(displayMonth)}
            today={pickerDate(today)}
            onSelect={(date) => {
              if (date) onSelect(pickerIso(date));
            }}
            onMonthChange={(date) => onMonthChange(monthStart(pickerIso(date)))}
            locale={zhCN}
            weekStartsOn={0}
            showOutsideDays={false}
            startMonth={pickerDate(monthStart(FIRST_DEMO_DATE))}
            endMonth={pickerDate(monthStart(LAST_DEMO_DATE))}
            disabled={[
              { before: pickerDate(FIRST_DEMO_DATE) },
              { after: pickerDate(LAST_DEMO_DATE) },
            ]}
            components={{ DayButton: LunarDayButton }}
            formatters={{
              formatWeekdayName: (date) =>
                ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
            }}
          />
        </EntryContext.Provider>
        <div className="calendar-legend">
          <span>
            <i className="event-dot" />
            有生日
          </span>
          <span>
            <i className="today-ring" />
            模拟今天
          </span>
          <span>选中日期，再点「＋」新建</span>
        </div>
      </section>
      <aside
        className="selected-day-card"
        aria-label="选中日期的事项"
        aria-live="polite"
      >
        <div className="selected-day-header">
          <div>
            <span className="selected-relative">{relative}</span>
            <h2>
              {Number(selectedDate.slice(5, 7))} 月{' '}
              {Number(selectedDate.slice(8))} 日
            </h2>
            <p>
              {selectedLunar.year} 农历年 · {lunarLabel(selectedLunar)}
            </p>
          </div>
          <Button
            className="day-add-button"
            onClick={onCreate}
            aria-label={`在 ${selectedDate} 新建事项`}
            title="在选中日期新建事项"
          >
            <Plus size={23} />
          </Button>
        </div>
        <div className="selected-events">
          <h3>
            这一天的事项 <span>{selectedEntries.length}</span>
          </h3>
          {selectedEntries.length ? (
            selectedEntries.map((entry) => (
              <Button
                variant="ghost"
                className="selected-event"
                key={entry.id}
                onClick={() => onOpenPerson(entry.person)}
              >
                <span className={`avatar avatar-${entry.person.color}`}>
                  {Array.from(entry.person.name)[0]}
                </span>
                <span className="selected-event-content">
                  <strong>{entry.title}</strong>
                  <span>农历{lunarLabel(entry.person)}</span>
                  {entry.occurrence.notes.map((note) => (
                    <span className="adjustment-note" key={note}>
                      {note}
                    </span>
                  ))}
                </span>
                <ChevronRight size={16} />
              </Button>
            ))
          ) : (
            <Empty className="empty-day">
              <EmptyHeader>
                <EmptyMedia>
                  <CalendarDays size={30} />
                </EmptyMedia>
                <EmptyTitle>这一天还没有事项</EmptyTitle>
                <EmptyDescription>
                  点击右上方「＋」，
                  <br />
                  从一个农历生日开始。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
        <div className="selected-day-tip">
          <Cake size={17} />
          <p>
            从所选日期带入农历生日。
            <br />
            保存后，每年按农历重新计算。
          </p>
        </div>
      </aside>
    </div>
  );
}
