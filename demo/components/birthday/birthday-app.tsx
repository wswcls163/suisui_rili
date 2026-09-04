'use client';

import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import {
  CalendarDays,
  Plus,
  Cake,
  ChevronRight,
  FlaskConical,
  RotateCcw,
  Check,
  BookHeart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { BirthdayPanel } from './birthday-panel';
import { BirthdayBook } from './birthday-book';
import { MonthCalendar } from './month-calendar';
import {
  birthdayRows,
  demoReducer,
  initialState,
  scenarioOf,
  visiblePeople,
  SCENARIOS,
} from '@/lib/birthday/demo-state';
import type { Draft, Person, ScenarioId } from '@/lib/birthday/demo-state';
import { lunarLabel, lunarOnDate } from '@/lib/birthday/calendar';
import { monthStart } from '@/lib/birthday/calendar-view';
import {
  browserRegistry,
  createDemoTools,
  registerDemoTools,
} from '@/lib/birthday/webmcp';

export function BirthdayApp() {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialState);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'edit' | 'detail'>('new');
  const [selected, setSelected] = useState<Person | null>(null);
  const [activeView, setActiveView] = useState('calendar');
  const [confirm, setConfirm] = useState<
    { kind: 'delete'; person: Person } | { kind: 'reset' } | null
  >(null);
  const [message, setMessage] = useState('');
  const scenario = scenarioOf(state);
  const selectedDate = state.selectedDate ?? scenario.date;
  const displayMonth = state.displayMonth ?? monthStart(scenario.date);
  const rows = birthdayRows(state);
  const todayRows = rows.filter((row) => row.remaining === 0);
  useEffect(
    () =>
      registerDemoTools(
        browserRegistry(),
        createDemoTools(
          () => stateRef.current,
          (action) => {
            flushSync(() => dispatch(action));
          },
        ),
        (error) => console.warn('生日演示工具注册失败', error),
      ),
    [],
  );

  function openNew() {
    setSelected(null);
    setMode('new');
    setPanelOpen(true);
  }
  function openPerson(person: Person) {
    setSelected(person);
    setMode('detail');
    setPanelOpen(true);
  }
  function saveBirthday(draft: Draft) {
    dispatch({
      type: 'save',
      id: mode === 'edit' && selected ? selected.id : crypto.randomUUID(),
      draft,
    });
    setPanelOpen(false);
    setMessage(`已保存「${draft.name}」的生日，月历和今日提醒已更新。`);
  }
  function switchScenario(id: ScenarioId) {
    dispatch({ type: 'scenario', id });
    setPanelOpen(false);
    setMessage('');
  }
  function confirmAction() {
    if (confirm?.kind === 'delete') {
      dispatch({ type: 'delete', id: confirm.person.id });
      setMessage(`已删除「${confirm.person.name}」的生日。`);
    } else if (confirm?.kind === 'reset') {
      dispatch({ type: 'reset' });
      setActiveView('calendar');
      setMessage('已恢复初始示例数据。');
    }
    setConfirm(null);
  }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">
              <CalendarDays size={23} />
            </span>
            <div>
              <div className="brand-name">岁岁日历</div>
              <div className="brand-en">SUISUI CALENDAR</div>
            </div>
          </div>
          <span className="demo-badge">交互 Demo</span>
        </div>
      </header>
      <main className="workspace calendar-page">
        <Tabs
          value={activeView}
          onValueChange={(value) => setActiveView(String(value))}
        >
          <div className="calendar-page-heading">
            <div>
              <p className="eyebrow">YOUR DAYS, REMEMBERED</p>
              <h1>我的日历</h1>
            </div>
            <TabsList className="view-tabs">
              <TabsTrigger value="calendar">
                <CalendarDays size={16} />
                日历
              </TabsTrigger>
              <TabsTrigger value="birthdays">
                <BookHeart size={16} />
                生日簿<span className="tab-count">{rows.length}</span>
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="scenario-strip">
            <span>
              <FlaskConical size={15} />
              模拟今天{' '}
              <strong>
                {scenario.date.replaceAll('-', '.')} · 农历
                {lunarLabel(lunarOnDate(scenario.date))}
              </strong>
            </span>
            <a href="#demo-controls">
              切换场景
              <ChevronRight size={14} />
            </a>
          </div>
          {message && (
            <output className="success-message">
              <Check size={16} />
              {message}
            </output>
          )}
          <section
            className={`compact-reminder ${todayRows.length ? 'has-birthdays' : ''}`}
            aria-label="今日生日提醒"
            aria-live="polite"
          >
            <span className="reminder-icon">
              <Cake size={22} />
            </span>
            <div className="reminder-copy">
              <h2>
                {todayRows.length
                  ? `今天有 ${todayRows.length} 位亲友过生日`
                  : '今天没有生日提醒'}
              </h2>
              {todayRows.length ? (
                <div className="reminder-names">
                  {todayRows.map(({ person, next }) => (
                    <Button
                      variant="ghost"
                      className="reminder-person"
                      key={person.id}
                      onClick={() => openPerson(person)}
                    >
                      <span>
                        {person.name} · 农历{lunarLabel(person)}
                        {next.notes.length > 0 && (
                          <span className="reminder-adjustment">
                            （{next.notes.join('；')}）
                          </span>
                        )}
                      </span>
                      <ChevronRight size={13} />
                    </Button>
                  ))}
                </div>
              ) : (
                <p>点选月历中的日期，查看或新建那一天的事项。</p>
              )}
            </div>
            <span className="reminder-today-label">模拟今天</span>
          </section>
          <TabsContent value="calendar">
            <MonthCalendar
              people={visiblePeople(state)}
              today={scenario.date}
              selectedDate={selectedDate}
              displayMonth={displayMonth}
              onSelect={(date) => dispatch({ type: 'select-date', date })}
              onMonthChange={(month) => dispatch({ type: 'view-month', month })}
              onCreate={openNew}
              onOpenPerson={openPerson}
            />
          </TabsContent>
          <TabsContent value="birthdays">
            <div className="book-toolbar">
              <p>保存农历生日，每一年重新计算。</p>
              <Button className="button-primary" onClick={openNew}>
                <Plus size={17} />
                新建事项
              </Button>
            </div>
            <BirthdayBook
              rows={rows}
              openNew={openNew}
              openPerson={openPerson}
            />
          </TabsContent>
        </Tabs>
        <footer className="demo-toolbar" id="demo-controls">
          <div>
            <p className="inline subtle">
              <FlaskConical size={15} />
              演示模式 · 模拟日期与亲友
            </p>
            <p className="demo-description">
              无后端，仅本页临时保存；刷新恢复示例。演示历表：2025—2028 农历年。
            </p>
          </div>
          <div className="demo-controls">
            <Select
              value={state.scenario}
              onValueChange={(value) => {
                if (value) switchScenario(value as ScenarioId);
              }}
            >
              <SelectTrigger className="scenario-select" aria-label="演示场景">
                <SelectValue>{scenario.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              className="button-quiet"
              onClick={() => setConfirm({ kind: 'reset' })}
              aria-label="重置演示"
            >
              <RotateCcw size={15} />
              重置
            </Button>
          </div>
        </footer>
      </main>
      <BirthdayPanel
        open={panelOpen}
        mode={mode}
        person={selected}
        today={scenario.date}
        selectedDate={selectedDate}
        onOpenChange={setPanelOpen}
        onEdit={() => setMode('edit')}
        onSave={saveBirthday}
        onDelete={(person) => {
          setPanelOpen(false);
          setConfirm({ kind: 'delete', person });
        }}
      />
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent className="confirm-dialog">
          <AlertDialogTitle className="confirm-title">
            {confirm?.kind === 'delete'
              ? `删除「${confirm.person.name}」的生日？`
              : '恢复初始演示？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm?.kind === 'delete'
              ? '该生日将从当前月历、生日簿和提醒中移除。你可以重新添加；刷新页面也会恢复原始示例。'
              : '本页添加、修改、删除的记录将被重置，回到默认的生日当天场景。'}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel className="button-secondary">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="button-primary"
              onClick={confirmAction}
            >
              {confirm?.kind === 'delete' ? '确认删除' : '恢复示例'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
