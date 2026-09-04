import { todayInBeijing, untilMidnight } from './dates';

export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };
export interface Scheduler {
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}
const scheduler: Scheduler = {
  set: (callback, delay) => setTimeout(callback, delay),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
// Foreground only: wakes at midnight or at most one minute after a clock change.
export class TodayWatcher {
  private handle: unknown = null;
  private active = false;
  constructor(
    private onToday: (date: string) => void,
    private clock: Clock = systemClock,
    private timers = scheduler,
  ) {}
  refresh = (): void => {
    this.onToday(todayInBeijing(this.clock.now()));
  };
  start(): void {
    this.stop();
    this.active = true;
    const tick = () => {
      if (!this.active) return;
      this.refresh();
      this.handle = this.timers.set(tick, Math.min(60_000, untilMidnight(this.clock.now())));
    };
    tick();
  }
  stop(): void {
    this.active = false;
    if (this.handle !== null) this.timers.clear(this.handle);
    this.handle = null;
  }
}
