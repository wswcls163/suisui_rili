import { upcomingOccurrences, daysUntil } from './calendar.ts';
import type { LunarBirthday } from './calendar.ts';
import { dateInMonth, isSupportedDate, monthStart } from './calendar-view.ts';
export type Person = LunarBirthday & {
  id: string;
  name: string;
  color: string;
};
export type Draft = LunarBirthday & { name: string };
export const SCENARIOS = [
  { id: 'today', label: '生日当天', date: '2026-10-18' },
  { id: 'ordinary', label: '今天没有生日', date: '2026-10-15' },
  { id: 'leap', label: '闰月生日', date: '2025-07-26' },
  { id: 'short', label: '小月三十', date: '2026-04-16' },
  { id: 'empty', label: '首次使用', date: '2026-10-18' },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]['id'];
export type DemoState = {
  people: Person[];
  emptyPeople: Person[];
  scenario: ScenarioId;
  selectedDate: string;
  displayMonth: string;
};
const SEEDS: Person[] = [
  { id: 'mom', name: '妈妈', month: 9, day: 9, isLeap: false, color: 'rose' },
  { id: 'aunt', name: '小姨', month: 9, day: 9, isLeap: true, color: 'gold' },
  {
    id: 'friend',
    name: '林小满',
    month: 9,
    day: 15,
    isLeap: false,
    color: 'green',
  },
  { id: 'dad', name: '爸爸', month: 10, day: 6, isLeap: false, color: 'blue' },
  {
    id: 'grandma',
    name: '外婆',
    month: 2,
    day: 30,
    isLeap: false,
    color: 'purple',
  },
  {
    id: 'brother',
    name: '弟弟',
    month: 6,
    day: 2,
    isLeap: true,
    color: 'green',
  },
];
export function initialState(): DemoState {
  return {
    people: SEEDS.map((p) => ({ ...p })),
    emptyPeople: [],
    scenario: 'today',
    selectedDate: '2026-10-18',
    displayMonth: '2026-10-01',
  };
}
export function visiblePeople(state: DemoState) {
  return state.scenario === 'empty' ? state.emptyPeople : state.people;
}
export function scenarioOf(state: DemoState) {
  return SCENARIOS.find((s) => s.id === state.scenario)!;
}
export function normalizeDraft(input: unknown): Draft {
  if (!input || typeof input !== 'object') throw new Error('请填写生日信息');
  const draft = input as Record<string, unknown>;
  if (typeof draft.name !== 'string' || !draft.name.trim())
    throw new Error('请填写姓名或称呼');
  if (draft.name.trim().length > 30)
    throw new Error('姓名或称呼不能超过 30 个字符');
  if (
    !Number.isInteger(draft.month) ||
    Number(draft.month) < 1 ||
    Number(draft.month) > 12
  )
    throw new Error('请选择农历月份');
  if (
    !Number.isInteger(draft.day) ||
    Number(draft.day) < 1 ||
    Number(draft.day) > 30
  )
    throw new Error('请选择农历日期');
  if (typeof draft.isLeap !== 'boolean')
    throw new Error('请明确是否为闰月生日');
  return {
    name: draft.name.trim(),
    month: draft.month as number,
    day: draft.day as number,
    isLeap: draft.isLeap,
  };
}
export type Action =
  | { type: 'select-date'; date: string }
  | { type: 'view-month'; month: string }
  | { type: 'scenario'; id: ScenarioId }
  | { type: 'save'; id: string; draft: Draft }
  | { type: 'delete'; id: string }
  | { type: 'reset' };
export function demoReducer(state: DemoState, action: Action): DemoState {
  if (action.type === 'reset') return initialState();
  if (action.type === 'select-date') {
    if (!isSupportedDate(action.date)) throw new Error('日期超出演示历表范围');
    return {
      ...state,
      selectedDate: action.date,
      displayMonth: monthStart(action.date),
    };
  }
  if (action.type === 'view-month') {
    return {
      ...state,
      displayMonth: monthStart(action.month),
      selectedDate: dateInMonth(
        state.selectedDate ?? scenarioOf(state).date,
        action.month,
      ),
    };
  }
  if (action.type === 'scenario') {
    if (!SCENARIOS.some((s) => s.id === action.id))
      throw new Error('未知演示场景');
    const date = SCENARIOS.find((s) => s.id === action.id)!.date;
    return {
      ...state,
      scenario: action.id,
      selectedDate: date,
      displayMonth: monthStart(date),
    };
  }
  const key = state.scenario === 'empty' ? 'emptyPeople' : 'people';
  const people = state[key];
  if (action.type === 'delete')
    return { ...state, [key]: people.filter((p) => p.id !== action.id) };
  const draft = normalizeDraft(action.draft);
  if (!action.id) throw new Error('生日记录缺少标识');
  const existing = people.find((p) => p.id === action.id);
  const updated = {
    ...draft,
    id: action.id,
    color:
      existing?.color ??
      ['rose', 'green', 'blue', 'gold', 'purple'][people.length % 5],
  };
  return {
    ...state,
    [key]: existing
      ? people.map((p) => (p.id === action.id ? updated : p))
      : [...people, updated],
  };
}
export function birthdayRows(state: DemoState) {
  const today = scenarioOf(state).date;
  return visiblePeople(state)
    .map((person) => {
      const next = upcomingOccurrences(person, today)[0];
      if (!next) throw new Error('演示历表中没有下次生日');
      return { person, next, remaining: daysUntil(next.solar, today) };
    })
    .sort((a, b) => a.remaining - b.remaining);
}
