import { avatarLocalRef, type AvatarPrivateStore } from './model';

const CACHE_NAME = 'suisui-private-account-avatars-v1';
const fallback = new Map<string, Uint8Array>();
const objectUrls = new Map<string, string>();

function safeRef(localRef: string): string {
  if (!/^[a-z0-9-]+-[a-f0-9]{16}\.jpg$/i.test(localRef)) throw new Error('头像本地引用无效');
  return localRef;
}

function cacheKey(localRef: string): string {
  return `https://suisui.local/__private_avatar_cache__/${encodeURIComponent(safeRef(localRef))}`;
}

function cacheStorage(): CacheStorage | null {
  return typeof globalThis.caches === 'undefined' ? null : globalThis.caches;
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function readBytes(localRef: string): Promise<Uint8Array | null> {
  const browserCaches = cacheStorage();
  if (!browserCaches) return fallback.get(localRef) ?? null;
  const response = await (await browserCaches.open(CACHE_NAME)).match(cacheKey(localRef));
  return response ? new Uint8Array(await response.arrayBuffer()) : null;
}

export const avatarPrivateStore: AvatarPrivateStore = {
  async persist(ownerKey, avatar) {
    const localRef = avatarLocalRef(ownerKey, avatar.hash);
    const bytes = Uint8Array.from(avatar.bytes);
    const browserCaches = cacheStorage();
    if (browserCaches) {
      const cache = await browserCaches.open(CACHE_NAME);
      await cache.put(
        cacheKey(localRef),
        new Response(arrayBuffer(bytes), { headers: { 'Content-Type': 'image/jpeg' } }),
      );
    } else fallback.set(localRef, bytes);
    const previous = objectUrls.get(localRef);
    if (previous) URL.revokeObjectURL(previous);
    const displayUri = URL.createObjectURL(new Blob([arrayBuffer(bytes)], { type: 'image/jpeg' }));
    objectUrls.set(localRef, displayUri);
    return { localRef, displayUri };
  },
  async resolve(localRef) {
    safeRef(localRef);
    const existing = objectUrls.get(localRef);
    if (existing) return existing;
    const bytes = await readBytes(localRef);
    if (!bytes) return null;
    const uri = URL.createObjectURL(new Blob([arrayBuffer(bytes)], { type: 'image/jpeg' }));
    objectUrls.set(localRef, uri);
    return uri;
  },
  read: readBytes,
  async remove(localRef) {
    safeRef(localRef);
    const uri = objectUrls.get(localRef);
    if (uri) URL.revokeObjectURL(uri);
    objectUrls.delete(localRef);
    fallback.delete(localRef);
    const browserCaches = cacheStorage();
    if (browserCaches) await (await browserCaches.open(CACHE_NAME)).delete(cacheKey(localRef));
  },
};
