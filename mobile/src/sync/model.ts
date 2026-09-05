import type { Birthday, BirthdayRepository } from '../core/birthday';

export const GUEST_OWNER = 'guest';

export function accountOwner(userId: string): string {
  if (!userId.trim()) throw new Error('账号标识不能为空');
  return `user:${userId}`;
}

export function isAccountOwner(ownerKey: string): boolean {
  return ownerKey.startsWith('user:') && ownerKey.length > 5;
}

export type RemoteBirthday = Birthday & {
  version: number;
  deletedAt: string | null;
};

export type SyncMutation = {
  ownerKey: string;
  operationId: string;
  birthdayId: string;
  kind: 'upsert' | 'delete';
  baseVersion: number;
  payload: Birthday | null;
  createdAt: string;
};

export type SyncConflict = {
  ownerKey: string;
  birthdayId: string;
  local: Birthday | null;
  remote: RemoteBirthday;
  createdAt: string;
};

export interface SyncBirthdayRepository extends BirthdayRepository {
  setOwner(ownerKey: string): Promise<void>;
  getOwner(): string;
  pending(): Promise<SyncMutation[]>;
  acknowledge(mutation: SyncMutation, remote: RemoteBirthday): Promise<void>;
  mergeRemote(records: RemoteBirthday[]): Promise<number>;
  recordConflict(mutation: SyncMutation, remote: RemoteBirthday): Promise<void>;
  conflicts(): Promise<SyncConflict[]>;
  resolveConflict(birthdayId: string, choice: 'local' | 'remote'): Promise<void>;
  guestCount(): Promise<number>;
  importGuest(): Promise<{ imported: number; skipped: number }>;
  clearGuest(): Promise<void>;
  clearOwner(ownerKey: string): Promise<void>;
}

export type ApplyMutationResult =
  { status: 'applied'; record: RemoteBirthday } | { status: 'conflict'; record: RemoteBirthday };

export interface RemoteBirthdayGateway {
  list(): Promise<RemoteBirthday[]>;
  apply(mutation: SyncMutation): Promise<ApplyMutationResult>;
}

export function isSyncBirthdayRepository(value: BirthdayRepository): value is SyncBirthdayRepository {
  return 'setOwner' in value && 'pending' in value && 'mergeRemote' in value;
}

export function birthdayFingerprint(value: Birthday): string {
  return JSON.stringify({
    name: value.name.trim(),
    lunar: value.lunar,
    solar: value.solar,
  });
}
