import * as SecureStore from 'expo-secure-store';
import { validAvatarMetadata, type AvatarMetadataStore } from './model';

const KEY_PREFIX = 'suisui.account-avatar.v1.';

function key(ownerKey: string): string {
  return `${KEY_PREFIX}${ownerKey.replace(/[^a-z0-9.-]/gi, '_')}`;
}

export const avatarMetadataStore: AvatarMetadataStore = {
  async load(ownerKey) {
    const serialized = await SecureStore.getItemAsync(key(ownerKey));
    if (!serialized) return null;
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (validAvatarMetadata(parsed, ownerKey)) return parsed;
    } catch {
      // 损坏的本地元数据不会被继续使用。
    }
    await SecureStore.deleteItemAsync(key(ownerKey));
    return null;
  },
  async save(metadata) {
    await SecureStore.setItemAsync(key(metadata.ownerKey), JSON.stringify(metadata));
  },
  async remove(ownerKey) {
    await SecureStore.deleteItemAsync(key(ownerKey));
  },
};
