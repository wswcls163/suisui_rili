import {
  birthdayRows,
  normalizeDraft,
  SCENARIOS,
  scenarioOf,
} from './demo-state.ts';
import type { Action, DemoState, ScenarioId } from './demo-state.ts';
export type DemoTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Registry = {
  registerTool: (
    tool: DemoTool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function createDemoTools(
  getState: () => DemoState,
  update: (action: Action) => void,
): DemoTool[] {
  return [
    {
      name: 'read_birthday_demo',
      title: '查看生日演示',
      description: '读取当前演示日期、生日和提醒，不改变数据。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({
        date: scenarioOf(getState()).date,
        people: birthdayRows(getState()).map(({ person, next, remaining }) => ({
          ...person,
          solar: next.solar,
          remaining,
          notes: next.notes,
        })),
      }),
    },
    {
      name: 'create_demo_birthday',
      title: '添加模拟生日',
      description:
        '在当前演示场景创建生日并更新可见列表。仅本页面临时数据，刷新恢复。',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 30 },
          month: { type: 'integer', minimum: 1, maximum: 12 },
          day: { type: 'integer', minimum: 1, maximum: 30 },
          isLeap: { type: 'boolean' },
        },
        required: ['name', 'month', 'day', 'isLeap'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) => {
        const draft = normalizeDraft(input);
        const id = crypto.randomUUID();
        update({ type: 'save', id, draft });
        return { id, name: draft.name, status: 'created' };
      },
    },
    {
      name: 'set_demo_scenario',
      title: '切换演示场景',
      description: '切换模拟日期或首次使用场景，不清除已有改动。',
      inputSchema: {
        type: 'object',
        properties: {
          scenario: { type: 'string', enum: SCENARIOS.map((s) => s.id) },
        },
        required: ['scenario'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const scenario = (input as { scenario?: unknown } | null)?.scenario;
        if (
          typeof scenario !== 'string' ||
          !SCENARIOS.some((s) => s.id === scenario)
        )
          throw new Error('未知演示场景');
        update({ type: 'scenario', id: scenario as ScenarioId });
        return { scenario, date: scenarioOf(getState()).date };
      },
    },
  ];
}
export function registerDemoTools(
  registry: Registry | undefined,
  tools: DemoTool[],
  report: (error: unknown) => void = () => {},
): () => void {
  const lifecycle = new AbortController();
  if (registry?.registerTool)
    for (const tool of tools) {
      try {
        void Promise.resolve(
          registry.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(report);
      } catch (error) {
        report(error);
      }
    }
  return () => lifecycle.abort();
}
export function browserRegistry(): Registry | undefined {
  return typeof document === 'undefined'
    ? undefined
    : (document as Document & { modelContext?: Registry }).modelContext;
}
