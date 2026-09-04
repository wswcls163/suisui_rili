import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, demoReducer } from '../lib/birthday/demo-state.ts';
import { createDemoTools, registerDemoTools } from '../lib/birthday/webmcp.ts';
import type { DemoTool } from '../lib/birthday/webmcp.ts';

void test('工具与可见界面共享 reducer，创建后可读取，非法输入不污染状态', () => {
  let state = initialState();
  const tools = createDemoTools(
    () => state,
    (action) => {
      state = demoReducer(state, action);
    },
  );
  const read = tools.find((t) => t.name === 'read_birthday_demo')!;
  const create = tools.find((t) => t.name === 'create_demo_birthday')!;
  const change = tools.find((t) => t.name === 'set_demo_scenario')!;
  assert.equal(read.annotations.readOnlyHint, true);
  assert.equal(create.annotations.readOnlyHint, false);
  const result = create.execute({
    name: '测试生日',
    month: 9,
    day: 9,
    isLeap: false,
  }) as { id: string };
  const rows = read.execute({}) as {
    people: { id: string; remaining: number }[];
  };
  assert.equal(rows.people.find((p) => p.id === result.id)?.remaining, 0);
  assert.throws(() =>
    create.execute({ name: '', month: 1, day: 1, isLeap: false }),
  );
  assert.equal(state.people.length, 7);
  assert.throws(() => change.execute({ scenario: 'unknown' }));
  assert.equal(state.scenario, 'today');
  assert.deepEqual(change.execute({ scenario: 'ordinary' }), {
    scenario: 'ordinary',
    date: '2026-10-15',
  });
});
void test('工具注册具有预期名称、输入描述和清理信号', () => {
  const registry = new Map<string, { tool: DemoTool; signal: AbortSignal }>();
  const tools = createDemoTools(initialState, () => {});
  const dispose = registerDemoTools(
    {
      registerTool(tool, options) {
        registry.set(tool.name, { tool, signal: options.signal });
      },
    },
    tools,
  );
  assert.deepEqual(
    [...registry.keys()],
    ['read_birthday_demo', 'create_demo_birthday', 'set_demo_scenario'],
  );
  assert.equal(
    (registry.get('create_demo_birthday')!.tool.inputSchema as { type: string })
      .type,
    'object',
  );
  dispose();
  assert.ok([...registry.values()].every((r) => r.signal.aborted));
});
void test('不支持 WebMCP 或注册失败不影响应用功能', async () => {
  assert.doesNotThrow(() => registerDemoTools(undefined, [])());
  const errors: unknown[] = [];
  registerDemoTools(
    {
      registerTool() {
        throw new Error('unsupported');
      },
    },
    createDemoTools(initialState, () => {}),
    (e) => errors.push(e),
  );
  assert.equal(errors.length, 3);
});
