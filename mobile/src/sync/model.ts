import type { Birthday, BirthdayRepository } from '../core/birthday';
import type { Countup, CountupRepository } from '../core/countup';

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

export type RemoteCountup = Countup & {
  version: number;
  deletedAt: string | null;
};

export type CalendarItem = Birthday | Countup;
export type RemoteItem = RemoteBirthday | RemoteCountup;
export type ItemType = 'birthday' | 'countup';

export function itemType(value: CalendarItem): ItemType {
  return 'type' in value && value.type === 'countup' ? 'countup' : 'birthday';
}

export type SyncMutation = {
  ownerKey: string;
  operationId: string;
  birthdayId: string;
  itemType: ItemType;
  kind: 'upsert' | 'delete';
  baseVersion: number;
  payload: CalendarItem | null;
  createdAt: string;
};

export type SyncConflict = {
  ownerKey: string;
  birthdayId: string;
  itemType: ItemType;
  local: CalendarItem | null;
  remote: RemoteItem;
  createdAt: string;
};

export interface SyncBirthdayRepository extends BirthdayRepository, CountupRepository {
  setOwner(ownerKey: string): Promise<void>;
  getOwner(): string;
  pending(): Promise<SyncMutation[]>;
  acknowledge(mutation: SyncMutation, remote: RemoteItem): Promise<void>;
  mergeRemote(records: RemoteItem[]): Promise<number>;
  recordConflict(mutation: SyncMutation, remote: RemoteItem): Promise<void>;
  conflicts(): Promise<SyncConflict[]>;
  resolveConflict(birthdayId: string, choice: 'local' | 'remote'): Promise<void>;
  guestCount(): Promise<number>;
  importGuest(): Promise<{ imported: number; skipped: number }>;
  clearGuest(): Promise<void>;
  clearOwner(ownerKey: string): Promise<void>;
}

export type ApplyMutationResult =
  { status: 'applied'; record: RemoteItem } | { status: 'conflict'; record: RemoteItem };

export interface RemoteBirthdayGateway {
  list(): Promise<RemoteItem[]>;
  apply(mutation: SyncMutation): Promise<ApplyMutationResult>;
}

export function isSyncBirthdayRepository(value: BirthdayRepository): value is SyncBirthdayRepository {
  return (
    'setOwner' in value &&
    'pending' in value &&
    'mergeRemote' in value &&
    'listCountups' in value &&
    'createCountup' in value
  );
}

export function itemFingerprint(value: CalendarItem): string {
  return itemType(value) === 'countup'
    ? JSON.stringify({
        type: 'countup',
        title: (value as Countup).title.trim(),
        startDate: (value as Countup).startDate,
        displayMode: (value as Countup).displayMode,
      })
    : JSON.stringify({
        type: 'birthday',
        name: (value as Birthday).name.trim(),
        lunar: (value as Birthday).lunar,
        solar: (value as Birthday).solar,
      });
}

export const birthdayFingerprint = itemFingerprint;
