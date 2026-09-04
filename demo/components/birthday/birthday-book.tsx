'use client';
import {
  CalendarDays,
  Plus,
  ArrowUpDown,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { lunarLabel } from '@/lib/birthday/calendar';
import type { Person, birthdayRows } from '@/lib/birthday/demo-state';
export function BirthdayBook({
  rows,
  openNew,
  openPerson,
}: {
  rows: ReturnType<typeof birthdayRows>;
  openNew: () => void;
  openPerson: (person: Person) => void;
}) {
  return (
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
                  <p className={`remaining ${remaining === 0 ? 'today' : ''}`}>
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
                <EmptyTitle className="empty-title">还没有记下生日</EmptyTitle>
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
  );
}
