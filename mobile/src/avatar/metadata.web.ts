import { validAvatarMetadata, type AvatarMetadataStore } from './model';

const KEY_PREFIX = 'suisui.account-avatar.v1.';
const memory = new Map<string, string>();

function key(ownerKey: string): string {
  return `${KEY_PREFIX}${ownerKey.replace(/[^a-z0-9.-]/gi, '_')}`;
}

function storage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

export const avatarMetadataStore: AvatarMetadataStore = {
  async load(ownerKey) {
    const itemKey = key(ownerKey);
    const serialized = storage()?.getItem(itemKey) ?? memory.get(itemKey) ?? null;
    if (!serialized) return null;
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (validAvatarMetadata(parsed, ownerKey)) return parsed;
    } catch {
      // 损坏的本地元数据不会被继续使用。
    }
    storage()?.removeItem(itemKey);
    memory.delete(itemKey);
    return null;
  },
  async save(metadata) {
    const itemKey = key(metadata.ownerKey);
    const serialized = JSON.stringify(metadata);
    const browser = storage();
    if (browser) browser.setItem(itemKey, serialized);
    else memory.set(itemKey, serialized);
  },
  async remove(ownerKey) {
    const itemKey = key(ownerKey);
    storage()?.removeItem(itemKey);
    memory.delete(itemKey);
  },
};
