import { dayNumber, requireSupported } from './dates';

export type CountupDraft = {
  type: 'countup';
  title: string;
  startDate: string;
  note: string;
};

export type Countup = CountupDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type CountupProgress =
  { phase: 'active'; day: number; elapsed: number } | { phase: 'upcoming'; remaining: number };

export function normalizeCountupDraft(value: unknown): CountupDraft {
  if (!value || typeof value !== 'object') throw new Error('请填写累计日信息');
  const input = value as Record<string, unknown>;
  if (input.type !== 'countup') throw new Error('累计日类型无效');
  if (typeof input.title !== 'string' || !input.title.trim()) throw new Error('请填写累计事项');
  const title = input.title.trim();
  if (Array.from(title).length > 30) throw new Error('累计事项不能超过 30 个字符');
  if (typeof input.startDate !== 'string') throw new Error('请选择开始日期');
  requireSupported(input.startDate);
  if (typeof input.note !== 'string') throw new Error('备注格式无效');
  const note = input.note.trim();
  if (Array.from(note).length > 120) throw new Error('备注不能超过 120 个字符');
  return { type: 'countup', title, startDate: input.startDate, note };
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

export interface CountupRepository {
  listCountups(): Promise<Countup[]>;
  createCountup(draft: CountupDraft): Promise<Countup>;
  updateCountup(id: string, draft: CountupDraft): Promise<Countup>;
  removeCountup(id: string): Promise<void>;
}
