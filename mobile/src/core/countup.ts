import { dayNumber, requireSupported } from './dates';

export type CountupDraft = {
  type: 'countup';
  title: string;
  startDate: string;
  note: string;
  displayMode: CountupDisplayMode;
};

export type CountupDisplayMode = 'days' | 'anniversary';

export const COUNTUP_DISPLAY_MODES = [
  { id: 'days', label: '记录天数', description: '每天显示第几天，适合健身、学习和习惯养成。' },
  { id: 'anniversary', label: '每年纪念', description: '显示周年与下一次纪念日，适合恋爱、结婚和入职。' },
] as const;

export type Countup = CountupDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type CountupProgress =
  { phase: 'active'; day: number; elapsed: number } | { phase: 'upcoming'; remaining: number };

export type AnniversaryProgress =
  | { phase: 'upcoming'; remaining: number }
  | {
      phase: 'active';
      years: number;
      isAnniversary: boolean;
      nextYears: number | null;
      nextDate: string | null;
      remaining: number | null;
    };

export function normalizeCountupDraft(value: unknown): CountupDraft {
  if (!value || typeof value !== 'object') throw new Error('请填写时光记信息');
  const input = value as Record<string, unknown>;
  if (input.type !== 'countup') throw new Error('时光记类型无效');
  if (typeof input.title !== 'string' || !input.title.trim()) throw new Error('请填写记录名称');
  const title = input.title.trim();
  if (Array.from(title).length > 30) throw new Error('记录名称不能超过 30 个字符');
  if (typeof input.startDate !== 'string') throw new Error('请选择开始日期');
  requireSupported(input.startDate);
  if (typeof input.note !== 'string') throw new Error('备注格式无效');
  const note = input.note.trim();
  if (Array.from(note).length > 120) throw new Error('备注不能超过 120 个字符');
  const displayMode = input.displayMode ?? 'days';
  if (displayMode !== 'days' && displayMode !== 'anniversary') throw new Error('请选择有效的展示方式');
  return { type: 'countup', title, startDate: input.startDate, note, displayMode };
}

export function countupProgress(startDate: string, today: string): CountupProgress {
  requireSupported(startDate);
  dayNumber(today);
  const difference = dayNumber(today) - dayNumber(startDate);
  return difference >= 0
    ? { phase: 'active', day: difference + 1, elapsed: difference }
    : { phase: 'upcoming', remaining: -difference };
}

export function countupProgressText(countup: CountupDraft, today: string): string {
  const progress = countupProgress(countup.startDate, today);
  return progress.phase === 'active' ? `第 ${progress.day} 天` : `${progress.remaining} 天后开始`;
}

export function anniversaryDate(startDate: string, year: number): string | null {
  if (year < 1901 || year > 2100) return null;
  const candidate = `${year}${startDate.slice(4)}`;
  try {
    requireSupported(candidate);
    return candidate;
  } catch {
    return startDate.slice(5) === '02-29' ? `${year}-02-28` : null;
  }
}

export function anniversaryProgress(startDate: string, today: string): AnniversaryProgress {
  const progress = countupProgress(startDate, today);
  if (progress.phase === 'upcoming') return progress;

  const startYear = Number(startDate.slice(0, 4));
  const currentYear = Number(today.slice(0, 4));
  const currentAnniversary = anniversaryDate(startDate, currentYear);
  const isAnniversary = currentYear > startYear && currentAnniversary === today;
  const years = Math.max(
    0,
    currentYear - startYear - (currentAnniversary !== null && today < currentAnniversary ? 1 : 0),
  );
  const nextYear = currentAnniversary !== null && today < currentAnniversary ? currentYear : currentYear + 1;
  const nextDate = anniversaryDate(startDate, nextYear);
  return {
    phase: 'active',
    years,
    isAnniversary,
    nextYears: nextDate === null ? null : nextYear - startYear,
    nextDate,
    remaining: nextDate === null ? null : dayNumber(nextDate) - dayNumber(today),
  };
}

export function timeNoteProgressText(countup: CountupDraft, today: string): string {
  if (countup.displayMode === 'days') return countupProgressText(countup, today);
  const progress = anniversaryProgress(countup.startDate, today);
  if (progress.phase === 'upcoming') return `${progress.remaining} 天后开始`;
  if (progress.isAnniversary) return `${progress.years} 周年`;
  if (progress.years === 0 && countup.startDate === today) return '今天开始';
  return progress.nextYears === null || progress.remaining === null
    ? `已走过 ${progress.years} 年`
    : `距 ${progress.nextYears} 周年 ${progress.remaining} 天`;
}

export interface CountupRepository {
  listCountups(): Promise<Countup[]>;
  createCountup(draft: CountupDraft): Promise<Countup>;
  updateCountup(id: string, draft: CountupDraft): Promise<Countup>;
  removeCountup(id: string): Promise<void>;
}
