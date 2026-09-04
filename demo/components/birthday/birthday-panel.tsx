'use client';

import { useState } from 'react';
import {
  CalendarDays,
  Info,
  Pencil,
  Trash2,
  X,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  MONTH_NAMES,
  DAY_NAMES,
  lunarLabel,
  upcomingOccurrences,
  daysUntil,
} from '@/lib/birthday/calendar';
import { normalizeDraft } from '@/lib/birthday/demo-state';
import type { Person, Draft } from '@/lib/birthday/demo-state';
import {
  draftFromDate,
  EVENT_TYPES,
  validateCreationType,
} from '@/lib/birthday/calendar-view';
import type { EventType } from '@/lib/birthday/calendar-view';

type Props = {
  open: boolean;
  mode: 'new' | 'edit' | 'detail';
  person: Person | null;
  today: string;
  selectedDate: string;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onSave: (draft: Draft) => void;
  onDelete: (person: Person) => void;
};

export function BirthdayPanel(props: Props) {
  const {
    open,
    mode,
    person,
    today,
    selectedDate,
    onOpenChange,
    onEdit,
    onSave,
    onDelete,
  } = props;
  const title =
    mode === 'new' ? '新建事项' : mode === 'edit' ? '编辑生日' : '生日详情';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="birthday-sheet" showCloseButton={false}>
        <SheetHeader className="panel-header">
          <p className="eyebrow">BIRTHDAY BOOK</p>
          <SheetTitle className="panel-title">{title}</SheetTitle>
          <SheetDescription>
            {mode === 'new'
              ? '从选中的一天开始，选择要记住的事项。'
              : '记住农历的这一天，每一年都不落下。'}
          </SheetDescription>
        </SheetHeader>
        <SheetClose
          render={
            <Button
              variant="ghost"
              className="panel-close"
              aria-label="关闭面板"
            />
          }
        >
          <X size={20} />
        </SheetClose>
        {mode === 'detail' && person ? (
          <BirthdayDetails
            person={person}
            today={today}
            onEdit={onEdit}
            onDelete={() => onDelete(person)}
          />
        ) : (
          <BirthdayForm
            key={`${mode}-${person?.id ?? 'new'}-${selectedDate}`}
            person={mode === 'edit' ? person : null}
            today={today}
            selectedDate={selectedDate}
            onSave={onSave}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function BirthdayForm({
  person,
  today,
  selectedDate,
  onSave,
  onCancel,
}: {
  person: Person | null;
  today: string;
  selectedDate: string;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [eventType, setEventType] = useState<EventType | null>(
    person ? 'birthday' : null,
  );
  const [draft, setDraft] = useState<Draft>(
    person
      ? {
          name: person.name,
          month: person.month,
          day: person.day,
          isLeap: person.isLeap,
        }
      : draftFromDate(selectedDate),
  );
  const [error, setError] = useState('');
  const next = upcomingOccurrences(draft, today)[0];
  return (
    <form
      className="birthday-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        try {
          validateCreationType(eventType ?? '');
          onSave(normalizeDraft(draft));
        } catch (err) {
          setError(err instanceof Error ? err.message : '保存失败，请重试');
        }
      }}
    >
      <div className="form-body">
        {!person && (
          <div className="creation-date-context">
            <CalendarDays size={19} />
            <div>
              <strong>所选日期 · {selectedDate.replaceAll('-', '.')}</strong>
              <p>
                农历{lunarLabel(draftFromDate(selectedDate))} ·
                已带入生日表单，可继续修改
              </p>
            </div>
          </div>
        )}
        <div className="form-field">
          <label id="event-type-label" htmlFor="event-type">
            事项类型 <span className="required">*</span>
          </label>
          <Select
            value={eventType}
            disabled={Boolean(person)}
            onValueChange={(value) => {
              if (value === null) return;
              validateCreationType(String(value));
              setEventType('birthday');
              setError('');
            }}
          >
            <SelectTrigger
              id="event-type"
              className="form-select event-type-select"
              aria-labelledby="event-type-label"
            >
              <SelectValue placeholder="请选择事项类型">
                {EVENT_TYPES.find((item) => item.id === eventType)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((item) => (
                <SelectItem
                  key={item.id}
                  value={item.id}
                  disabled={!item.available}
                >
                  {item.label}
                  {!item.available && (
                    <span className="future-type">后续开放</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="field-hint">
            第一期支持农历生日，其他类型后续逐步开放。
          </p>
        </div>
        {eventType !== 'birthday' ? (
          <div className="choose-type-hint">
            <Info size={18} />
            <p>
              先选择「生日」，再填写亲友姓名。
              <br />
              所选日期对应的农历月、日和闰月标记会自动带入。
            </p>
          </div>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="birthday-name">
                姓名或称呼 <span className="required">*</span>
              </label>
              <input
                id="birthday-name"
                autoComplete="off"
                maxLength={30}
                placeholder="例如：妈妈、林小满"
                value={draft.name}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'birthday-error' : undefined}
                onChange={(e) => {
                  setDraft({ ...draft, name: e.target.value });
                  setError('');
                }}
              />
              {error && (
                <p className="form-error" id="birthday-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="form-field">
              <span className="field-label" id="lunar-date-label">
                农历生日 <span className="required">*</span>
              </span>
              <div className="date-selects">
                <Select
                  value={draft.month}
                  onValueChange={(value) => {
                    if (value !== null)
                      setDraft({ ...draft, month: Number(value) });
                  }}
                >
                  <SelectTrigger className="form-select" aria-label="农历月份">
                    <SelectValue>{MONTH_NAMES[draft.month - 1]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, index) => (
                      <SelectItem key={name} value={index + 1}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={draft.day}
                  onValueChange={(value) => {
                    if (value !== null)
                      setDraft({ ...draft, day: Number(value) });
                  }}
                >
                  <SelectTrigger className="form-select" aria-label="农历日期">
                    <SelectValue>{DAY_NAMES[draft.day - 1]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((name, index) => (
                      <SelectItem key={name} value={index + 1}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="field-hint">
                请填写农历日期，不是身份证上的阳历日期。
              </p>
            </div>
            <div className="leap-choice">
              <div>
                <label htmlFor="birthday-leap">这是闰月生日</label>
                <p className="field-hint">普通月份生日无需开启</p>
              </div>
              <Switch
                id="birthday-leap"
                checked={draft.isLeap}
                onCheckedChange={(value) =>
                  setDraft({ ...draft, isLeap: value })
                }
              />
            </div>
            <div className="form-rules">
              <Info size={17} />
              <div>
                <p>
                  {draft.isLeap
                    ? '当年有对应闰月时按闰月过；没有时按普通月过。'
                    : '每年按照农历日期重新计算，不固定重复阳历日期。'}
                </p>
                <p>
                  {draft.day === 30
                    ? '若适用月份只有二十九天，会提前到二十九提醒。'
                    : '第一期仅在打开应用时提醒，不发送后台通知。'}
                </p>
              </div>
            </div>
            {next && (
              <section className="date-preview">
                <p className="inline preview-label">
                  <CalendarDays size={16} />
                  下次生日预览 · 相对模拟今天
                </p>
                <p className="preview-date">
                  {next.solar.replaceAll('-', '.')}
                </p>
                <p>
                  农历{lunarLabel(draft)}{' '}
                  <span className="subtle">
                    ·{' '}
                    {daysUntil(next.solar, today) === 0
                      ? '就是演示中的今天'
                      : `${daysUntil(next.solar, today)} 天后`}
                  </span>
                </p>
                {next.notes.map((note) => (
                  <p className="adjustment-note" key={note}>
                    {note}
                  </p>
                ))}
              </section>
            )}
          </>
        )}
        <p className="demo-form-note">
          Demo 数据仅保留在当前页面，刷新后恢复示例。
        </p>
      </div>
      <div className="panel-actions">
        <Button type="button" className="button-secondary" onClick={onCancel}>
          取消
        </Button>
        <Button
          type="submit"
          className="button-primary"
          disabled={eventType !== 'birthday'}
        >
          {person ? '保存修改' : eventType ? '保存生日' : '请选择类型'}
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
}

function BirthdayDetails({
  person,
  today,
  onEdit,
  onDelete,
}: {
  person: Person;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const occurrences = upcomingOccurrences(person, today).slice(0, 3);
  return (
    <div className="detail-body">
      <div className="detail-profile">
        <span className={`avatar avatar-${person.color}`}>
          {Array.from(person.name)[0]}
        </span>
        <h2>{person.name}</h2>
        <p>农历{lunarLabel(person)}</p>
        <span className="subtle">每个农历年提醒一次</span>
      </div>
      <div className="detail-dates">
        <h3>接下来的生日</h3>
        {occurrences.map((item, index) => (
          <div className="year-occurrence" key={item.lunarYear}>
            <div className="occurrence-heading">
              <span>
                {item.lunarYear} 农历年
                {index === 0 && <span className="small-tag">下次</span>}
              </span>
              <strong>{item.solar.replaceAll('-', '.')}</strong>
            </div>
            <p className="subtle">
              实际按
              {lunarLabel({
                month: Math.abs(item.actualMonth),
                day: item.actualDay,
                isLeap: item.actualMonth < 0,
              })}
              提醒
            </p>
            {item.notes.map((note) => (
              <p className="adjustment-note" key={note}>
                {note}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p className="form-rules">
        <Info size={17} />
        <span>原始生日始终保留。闰月或小月调整只影响对应年份的提醒。</span>
      </p>
      <div className="panel-actions">
        <Button className="button-quiet delete-button" onClick={onDelete}>
          <Trash2 size={16} />
          删除生日
        </Button>
        <Button className="button-primary" onClick={onEdit}>
          <Pencil size={16} />
          编辑生日
        </Button>
      </div>
    </div>
  );
}
