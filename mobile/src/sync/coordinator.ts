import type { RemoteBirthdayGateway, SyncBirthdayRepository } from './model';
import { isAccountOwner } from './model';

export type SyncSummary = { uploaded: number; downloaded: number; conflicts: number };

export class SyncCoordinator {
  private running: Promise<SyncSummary> | null = null;
  private runningOwner: string | null = null;
  private requested = false;

  constructor(
    private local: SyncBirthdayRepository,
    private remote: RemoteBirthdayGateway,
  ) {}

  sync(ownerKey: string): Promise<SyncSummary> {
    if (!isAccountOwner(ownerKey)) return Promise.resolve({ uploaded: 0, downloaded: 0, conflicts: 0 });
    if (this.running) {
      if (this.runningOwner === ownerKey) {
        this.requested = true;
        return this.running;
      }
      return this.running.then(
        () => this.sync(ownerKey),
        () => this.sync(ownerKey),
      );
    }
    this.runningOwner = ownerKey;
    let task: Promise<SyncSummary>;
    task = (async () => {
      let summary: SyncSummary;
      do {
        this.requested = false;
        summary = await this.run(ownerKey);
      } while (this.requested);
      return summary!;
    })().finally(() => {
      if (this.running === task) {
        this.running = null;
        this.runningOwner = null;
      }
    });
    this.running = task;
    return task;
  }

  private async run(ownerKey: string): Promise<SyncSummary> {
    let uploaded = 0;
    let conflicts = 0;
    if (this.local.getOwner() !== ownerKey) return { uploaded, downloaded: 0, conflicts };
    for (const mutation of await this.local.pending()) {
      if (this.local.getOwner() !== ownerKey) return { uploaded, downloaded: 0, conflicts };
      if (mutation.ownerKey !== ownerKey) continue;
      const result = await this.remote.apply(mutation);
      if (this.local.getOwner() !== ownerKey) return { uploaded, downloaded: 0, conflicts };
      if (result.status === 'conflict') {
        await this.local.recordConflict(mutation, result.record);
        conflicts++;
      } else {
        await this.local.acknowledge(mutation, result.record);
        uploaded++;
      }
    }
    if (this.local.getOwner() !== ownerKey) return { uploaded, downloaded: 0, conflicts };
    const records = await this.remote.list(ownerKey);
    if (this.local.getOwner() !== ownerKey) return { uploaded, downloaded: 0, conflicts };
    const downloaded = await this.local.mergeRemote(records, ownerKey);
    return { uploaded, downloaded, conflicts };
  }
}
