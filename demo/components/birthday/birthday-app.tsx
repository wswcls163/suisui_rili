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
  ArrowUpDown,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  FlaskConical,
  RotateCcw,
  Check,
  Heart,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { BirthdayPanel } from './birthday-panel';
import {
  birthdayRows,
  demoReducer,
  initialState,
  scenarioOf,
  SCENARIOS,
} from '@/lib/birthday/demo-state';
import type { Draft, Person, ScenarioId } from '@/lib/birthday/demo-state';
import { lunarLabel, lunarOnDate } from '@/lib/birthday/calendar';
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
  const [confirm, setConfirm] = useState<
    { kind: 'delete'; person: Person } | { kind: 'reset' } | null
  >(null);
  const [message, setMessage] = useState('');
  const scenario = scenarioOf(state);
  const rows = birthdayRows(state);
  const todayRows = rows.filter((row) => row.remaining === 0);
  const date = new Date(scenario.date + 'T12:00:00Z');
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getUTCDay()];
  const nextPerson = rows.find((row) => row.remaining > 0);

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
    setMessage(`已保存「${draft.name}」的生日，提醒已更新。`);
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
          <div className="header-right">
            <span className="demo-badge">交互 Demo</span>
            <a className="button-quiet" href="#reminder-rules">
              提醒规则
            </a>
          </div>
        </div>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">MY BIRTHDAY BOOK</p>
            <h1>生日簿</h1>
          </div>
          <Button className="button-primary" onClick={openNew}>
            <Plus />
            添加生日
          </Button>
        </div>
        <div className="scenario-strip">
          <span>
            <FlaskConical size={15} />
            模拟日期{' '}
            <strong>
              {scenario.date.replaceAll('-', '.')} · {scenario.label}
            </strong>
          </span>
          <a href="#demo-controls">
            切换演示场景 <ChevronRight size={14} />
          </a>
        </div>
        {message && (
          <output className="success-message">
            <Check size={16} />
            {message}
          </output>
        )}
        <div className="headline-grid">
          <section
            className="birthday-banner"
            aria-label="当天生日提醒"
            aria-live="polite"
          >
            <div>
              <p className="banner-kicker">
                {todayRows.length ? <Cake size={17} /> : <Heart size={17} />}
                今日生日 · {todayRows.length} 位亲友
              </p>
              <h2>
                {todayRows.length
                  ? '今天，记得送上一句生日快乐。'
                  : rows.length
                    ? '今天没有生日，牵挂一直都在。'
                    : '从一个生日开始，记住重要的人。'}
              </h2>
            </div>
            {todayRows.length ? (
              <div className="today-people">
                {todayRows.map(({ person, next }) => (
                  <Button
                    className="today-person"
                    key={person.id}
                    onClick={() => openPerson(person)}
                    aria-label={`查看${person.name}的生日提醒`}
                  >
                    <span className={`avatar avatar-${person.color}`}>
                      {Array.from(person.name)[0]}
                    </span>
                    <div>
                      <strong>{person.name}</strong>
                      <p className="person-detail">农历{lunarLabel(person)}</p>
                      {next.notes.map((note) => (
                        <p key={note} className="banner-adjustment">
                          {note}
                        </p>
                      ))}
                    </div>
                    <ChevronRight size={16} />
                  </Button>
                ))}
              </div>
            ) : nextPerson ? (
              <p className="next-message">
                下一位是{' '}
                <button onClick={() => openPerson(nextPerson.person)}>
                  {nextPerson.person.name}
                </button>
                ，还有 <strong>{nextPerson.remaining}</strong> 天。
                <span>农历{lunarLabel(nextPerson.person)}</span>
              </p>
            ) : (
              <p className="next-message">
                添加农历生日，每年在对的那一天看到提醒。
              </p>
            )}
          </section>
          <aside className="date-card" aria-label="演示日期">
            <p className="date-top">
              {date.getUTCFullYear()} 年 {date.getUTCMonth() + 1} 月 · 星期
              {weekday}
            </p>
            <p className="day">{date.getUTCDate()}</p>
            <p className="date-bottom">
              农历{lunarLabel(lunarOnDate(scenario.date))}
            </p>
          </aside>
        </div>
        <div className="content-grid">
          <section>
            <div className="list-heading">
              <h2>
                亲友生日<span className="count-label">{rows.length} 人</span>
              </h2>
              <span className="sort-label">
                <ArrowUpDown size={14} />
                按下次生日排序
              </span>
            </div>
            <div className="birthday-list">
              {rows.length ? (
                rows.map(({ person, next, remaining }) => (
                  <article className="person-row" key={person.id}>
                    <span className={`avatar avatar-${person.color}`}>
                      {Array.from(person.name)[0]}
                    </span>
                    <button
                      className="person-info"
                      onClick={() => openPerson(person)}
                      aria-label={`查看${person.name}的生日`}
                    >
                      <p className="person-name">
                        {person.name}
                        {next.notes.length > 0 && (
                          <span className="small-tag">日期调整</span>
                        )}
                      </p>
                      <p className="lunar-label">农历{lunarLabel(person)}</p>
                    </button>
                    <div className="person-date">
                      <p
                        className={`remaining ${remaining === 0 ? 'today' : ''}`}
                      >
                        {remaining === 0 ? '今天' : `${remaining} 天后`}
                      </p>
                      <p className="solar-label">
                        {next.solar.replaceAll('-', '.')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="icon-button"
                      aria-label={`管理${person.name}的生日`}
                      onClick={() => openPerson(person)}
                    >
                      <ChevronRight size={18} />
                    </Button>
                  </article>
                ))
              ) : (
                <Empty className="empty-birthdays">
                  <EmptyHeader>
                    <EmptyMedia>
                      <CalendarDays size={38} />
                    </EmptyMedia>
                    <EmptyTitle className="empty-title">
                      还没有记下生日
                    </EmptyTitle>
                    <EmptyDescription>
                      先从你最牵挂的那个人开始。
                      <br />
                      只需一个称呼和农历日期。
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button className="button-primary" onClick={openNew}>
                      <Plus size={16} />
                      添加第一个生日
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </div>
            <p className="list-footnote">
              <Info size={14} />
              点击亲友可查看逐年日期、编辑或删除生日。
            </p>
          </section>
          <aside>
            <section className="rules-card" id="reminder-rules">
              <h2>
                <BookOpen size={17} />
                农历生日，怎么算？
              </h2>
              <div className="rule-item">
                <span className="rule-index">01</span>
                <div>
                  <h3>每年重新计算</h3>
                  <p>记住农历日期，不固定重复阳历日期。</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-index">02</span>
                <div>
                  <h3>没有闰月，按普通月</h3>
                  <p>有对应闰月时按闰月；没有时按普通月份过。</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-index">03</span>
                <div>
                  <h3>小月三十，提前一天</h3>
                  <p>当月只有二十九天时，就在二十九提醒。</p>
                </div>
              </div>
            </section>
            <p className="privacy-note">
              <ShieldCheck size={16} />
              仅在应用内提醒，不发送后台通知。
            </p>
          </aside>
        </div>
        <footer className="demo-toolbar" id="demo-controls">
          <div>
            <p className="inline subtle">
              <FlaskConical size={15} />
              演示模式 · 模拟日期与亲友
            </p>
            <p className="demo-description">
              无后端，仅本页临时保存；刷新恢复示例数据。
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
              ? '该生日将从当前演示列表和提醒中移除。你可以重新添加；刷新页面也会恢复原始示例。'
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
