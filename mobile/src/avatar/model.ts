export const AVATAR_BUCKET = 'account-avatars';
export const AVATAR_SIZE = 512;
export const AVATAR_JPEG_QUALITY = 0.82;

export type AvatarSyncState = 'synced' | 'pending-upload' | 'pending-delete';

export type AvatarMetadata = {
  ownerKey: string;
  localRef: string | null;
  hash: string | null;
  remotePath: string;
  updatedAt: string;
  syncState: AvatarSyncState;
};

export type ProcessedAvatar = {
  bytes: Uint8Array;
  hash: string;
  width: typeof AVATAR_SIZE;
  height: typeof AVATAR_SIZE;
  mimeType: 'image/jpeg';
};

export type StoredAvatar = {
  localRef: string;
  displayUri: string;
};

export interface AvatarMetadataStore {
  load(ownerKey: string): Promise<AvatarMetadata | null>;
  save(metadata: AvatarMetadata): Promise<void>;
  remove(ownerKey: string): Promise<void>;
}

export interface AvatarPrivateStore {
  persist(ownerKey: string, avatar: ProcessedAvatar): Promise<StoredAvatar>;
  resolve(localRef: string): Promise<string | null>;
  read(localRef: string): Promise<Uint8Array | null>;
  remove(localRef: string): Promise<void>;
}

export interface AvatarImageProcessor {
  pick(): Promise<ProcessedAvatar | null>;
}

export interface AvatarRemoteGateway {
  download(ownerKey: string): Promise<Uint8Array | null>;
  upload(ownerKey: string, bytes: Uint8Array): Promise<void>;
  remove(ownerKey: string): Promise<void>;
}

function avatarUserId(ownerKey: string): string {
  if (!ownerKey.startsWith('user:')) throw new Error('头像账号范围无效');
  const userId = ownerKey.slice(5);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))
    throw new Error('头像账号范围无效');
  return userId;
}

export function avatarRemotePath(ownerKey: string): string {
  return `${avatarUserId(ownerKey)}/avatar.jpg`;
}

export function avatarLocalRef(ownerKey: string, hash: string): string {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('头像哈希无效');
  return `${avatarUserId(ownerKey)}-${hash.slice(0, 16).toLowerCase()}.jpg`;
}

export function validAvatarMetadata(value: unknown, ownerKey: string): value is AvatarMetadata {
  if (!value || typeof value !== 'object') return false;
  try {
    const row = value as Partial<AvatarMetadata>;
    if (
      row.ownerKey !== ownerKey ||
      row.remotePath !== avatarRemotePath(ownerKey) ||
      typeof row.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(row.updatedAt)) ||
      !['synced', 'pending-upload', 'pending-delete'].includes(row.syncState ?? '')
    )
      return false;
    if (row.syncState === 'pending-delete') return row.localRef === null && row.hash === null;
    return (
      typeof row.hash === 'string' &&
      typeof row.localRef === 'string' &&
      row.localRef === avatarLocalRef(ownerKey, row.hash)
    );
  } catch {
    return false;
  }
}

export function avatarInitial(email: string | undefined): string {
  return email ? (Array.from(email.trim())[0]?.toUpperCase() ?? '') : '';
}

export function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function cloneBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

export function bytesBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
