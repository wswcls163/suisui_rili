import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dexie } from 'dexie';
import { WebBirthdayRepository } from '../src/data/web';
import { SyncCoordinator } from '../src/sync/coordinator';
import type { ApplyMutationResult, RemoteItem, RemoteBirthdayGateway, SyncMutation } from '../src/sync/model';

class MemoryGateway implements RemoteBirthdayGateway {
  records = new Map<string, RemoteItem>();
  recordOwners = new Map<string, string>();
  applyCalls = 0;
  listCalls = 0;
  listOwners: string[] = [];

  async list(ownerKey: string): Promise<RemoteItem[]> {
    this.listCalls++;
    this.listOwners.push(ownerKey);
    return [...this.records.entries()]
      .filter(([id]) => this.recordOwners.get(id) === ownerKey)
      .map(([, record]) => record);
  }

  async apply(mutation: SyncMutation): Promise<ApplyMutationResult> {
    this.applyCalls++;
    const current = this.records.get(mutation.birthdayId);
    if ((current?.version ?? 0) !== mutation.baseVersion) return { status: 'conflict', record: current! };
    const source = mutation.payload ?? current;
    assert.ok(source);
    const stamp = new Date(2026, 0, this.applyCalls).toISOString();
    const record: RemoteItem = {
      ...source,
      updatedAt: stamp,
      version: mutation.baseVersion + 1,
      deletedAt: mutation.kind === 'delete' ? stamp : null,
    };
    this.records.set(record.id, record);
    this.recordOwners.set(record.id, mutation.ownerKey);
    return { status: 'applied', record };
  }
}

const draft = { name: '妈妈', lunar: { month: 12, day: 9, isLeap: false }, solar: null };

test('同步协调器上传本机修改、拉取云端修改，并处理并发编辑冲突', async () => {
  const name = `suisui-sync-${Date.now()}`;
  let sequence = 0;
  const repo = new WebBirthdayRepository(name, () => `sync-${++sequence}`);
  const gateway = new MemoryGateway();
  const coordinator = new SyncCoordinator(repo, gateway);
  try {
    await repo.setOwner('user:one');
    const local = await repo.create(draft);
    assert.deepEqual(await coordinator.sync('user:one'), { uploaded: 1, downloaded: 0, conflicts: 0 });
    assert.equal((await repo.pending()).length, 0);
    assert.equal(gateway.records.get(local.id)?.version, 1);

    await repo.update(local.id, { ...draft, name: '本机修改' });
    gateway.records.set(local.id, {
      ...gateway.records.get(local.id)!,
      name: '另一台设备修改',
      version: 2,
    });
    assert.deepEqual(await coordinator.sync('user:one'), { uploaded: 0, downloaded: 1, conflicts: 1 });
    assert.equal('name' in (await repo.conflicts())[0].local!, true);
    assert.equal(((await repo.conflicts())[0].local as { name: string }).name, '本机修改');
    assert.equal((await repo.list())[0].name, '另一台设备修改');

    await repo.resolveConflict(local.id, 'local');
    assert.equal((await repo.pending())[0].baseVersion, 2);
    assert.deepEqual(await coordinator.sync('user:one'), { uploaded: 1, downloaded: 0, conflicts: 0 });
    assert.equal((gateway.records.get(local.id) as { name: string }).name, '本机修改');
    assert.equal(gateway.records.get(local.id)?.version, 3);
  } finally {
    await repo.close();
    await Dexie.delete(name);
  }
});

test('账号切换时旧同步停止落库，新账号同步排队后独立执行', async () => {
  const name = `suisui-sync-owner-switch-${Date.now()}`;
  let sequence = 0;
  const repo = new WebBirthdayRepository(name, () => `owner-switch-${++sequence}`);
  let release!: () => void;
  let started!: () => void;
  const applyStarted = new Promise<void>((resolve) => (started = resolve));
  const resumeApply = new Promise<void>((resolve) => (release = resolve));
  const gateway = new MemoryGateway();
  const originalApply = gateway.apply.bind(gateway);
  gateway.apply = async (mutation) => {
    started();
    await resumeApply;
    return originalApply(mutation);
  };
  const coordinator = new SyncCoordinator(repo, gateway);
  try {
    await repo.setOwner('user:one');
    await repo.create(draft);
    const first = coordinator.sync('user:one');
    await applyStarted;
    await repo.setOwner('user:two');
    const second = coordinator.sync('user:two');
    assert.notEqual(first, second);
    release();
    await first;
    await second;
    assert.deepEqual(gateway.listOwners, ['user:two']);
    assert.equal(gateway.applyCalls, 1);
    assert.deepEqual(await repo.list(), []);
  } finally {
    await repo.close();
    await Dexie.delete(name);
  }
});

test('访客范围不会访问云端', async () => {
  const name = `suisui-sync-guest-${Date.now()}`;
  const repo = new WebBirthdayRepository(name, () => 'guest-record');
  const gateway = new MemoryGateway();
  try {
    await repo.create(draft);
    assert.deepEqual(await new SyncCoordinator(repo, gateway).sync('guest'), {
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
    });
    assert.equal(gateway.applyCalls, 0);
    assert.equal(gateway.listCalls, 0);
  } finally {
    await repo.close();
    await Dexie.delete(name);
  }
});

test('时光记的展示方式通过同一离线队列上传并拉取', async () => {
  const name = `suisui-sync-countup-${Date.now()}`;
  let sequence = 0;
  const repo = new WebBirthdayRepository(name, () => `countup-sync-${++sequence}`);
  const gateway = new MemoryGateway();
  try {
    await repo.setOwner('user:countup');
    const local = await repo.createCountup({
      type: 'countup',
      title: '坚持健身',
      startDate: '2026-09-05',
      note: '每天半小时',
      displayMode: 'anniversary',
    });
    assert.equal((await repo.pending())[0].itemType, 'countup');
    assert.deepEqual(await new SyncCoordinator(repo, gateway).sync('user:countup'), {
      uploaded: 1,
      downloaded: 0,
      conflicts: 0,
    });
    const remote = gateway.records.get(local.id);
    assert.ok(remote && 'title' in remote);
    assert.equal(remote.title, '坚持健身');
    assert.equal(remote.displayMode, 'anniversary');
    assert.equal((await repo.listCountups())[0].startDate, '2026-09-05');
    assert.deepEqual(await repo.list(), []);
  } finally {
    await repo.close();
    await Dexie.delete(name);
  }
});
