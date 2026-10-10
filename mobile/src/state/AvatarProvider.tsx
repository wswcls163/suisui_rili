import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { avatarImageProcessor } from '../avatar/processor';
import { avatarMetadataStore } from '../avatar/metadata';
import { avatarPrivateStore } from '../avatar/private-store';
import { avatarRemoteGateway } from '../avatar/remote';
import {
  AVATAR_SIZE,
  avatarRemotePath,
  bytesBuffer,
  bytesToHex,
  type AvatarImageProcessor,
  type AvatarMetadata,
  type AvatarMetadataStore,
  type AvatarPrivateStore,
  type AvatarRemoteGateway,
  type AvatarSyncState,
  type ProcessedAvatar,
} from '../avatar/model';
import { accountOwner } from '../sync/model';
import { useAuth } from './AuthProvider';

export type AvatarStatus = 'guest' | 'loading' | 'ready' | 'syncing' | 'pending' | 'error';

type AvatarContextValue = {
  uri: string | null;
  status: AvatarStatus;
  syncState: AvatarSyncState | null;
  error: string;
  chooseAvatar(): Promise<void>;
  deleteAvatar(): Promise<void>;
  retry(): Promise<void>;
  clearLocalOwner(ownerKey: string): Promise<void>;
};

const fallback: AvatarContextValue = {
  uri: null,
  status: 'guest',
  syncState: null,
  error: '',
  chooseAvatar: async () => {},
  deleteAvatar: async () => {},
  retry: async () => {},
  clearLocalOwner: async () => {},
};

const AvatarContext = createContext<AvatarContextValue>(fallback);

function friendlyAvatarError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  if (/network|fetch|offline|internet|timeout/i.test(message))
    return '网络暂时不可用，头像已保存在本机，可稍后重试同步';
  if (/bucket|row-level|policy|storage/i.test(message))
    return '云端头像空间尚未部署，头像已保存在本机，可稍后重试同步';
  return message || '头像操作没有完成，请重试';
}

async function defaultHash(bytes: Uint8Array): Promise<string> {
  return bytesToHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytesBuffer(bytes)));
}

export function AvatarProvider({
  children,
  metadataStore = avatarMetadataStore,
  privateStore = avatarPrivateStore,
  processor = avatarImageProcessor,
  gateway = avatarRemoteGateway,
  hashBytes = defaultHash,
}: {
  children: React.ReactNode;
  metadataStore?: AvatarMetadataStore;
  privateStore?: AvatarPrivateStore;
  processor?: AvatarImageProcessor;
  gateway?: AvatarRemoteGateway | null;
  hashBytes?: (bytes: Uint8Array) => Promise<string>;
}) {
  const auth = useAuth();
  const ownerKey = auth.session ? accountOwner(auth.session.userId) : null;
  const ownerRef = useRef<string | null>(ownerKey);
  const generation = useRef(0);
  const [uri, setUri] = useState<string | null>(null);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [status, setStatus] = useState<AvatarStatus>(ownerKey ? 'loading' : 'guest');
  const [syncState, setSyncState] = useState<AvatarSyncState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    ownerRef.current = ownerKey;
  }, [ownerKey]);

  const current = useCallback((target: string, token: number) => {
    return ownerRef.current === target && generation.current === token;
  }, []);

  const saveRemoteCopy = useCallback(
    async (target: string, bytes: Uint8Array, previous: AvatarMetadata | null, token: number) => {
      const hash = await hashBytes(bytes);
      const avatar: ProcessedAvatar = {
        bytes,
        hash,
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        mimeType: 'image/jpeg',
      };
      const stored = await privateStore.persist(target, avatar);
      if (!current(target, token)) return;
      const metadata: AvatarMetadata = {
        ownerKey: target,
        localRef: stored.localRef,
        hash,
        remotePath: avatarRemotePath(target),
        updatedAt: new Date().toISOString(),
        syncState: 'synced',
      };
      await metadataStore.save(metadata);
      if (previous?.localRef && previous.localRef !== stored.localRef)
        await privateStore.remove(previous.localRef).catch(() => {});
      if (!current(target, token)) return;
      setUri(stored.displayUri);
      setLoadedOwner(target);
      setSyncState('synced');
      setStatus('ready');
      setError('');
    },
    [current, hashBytes, metadataStore, privateStore],
  );

  const synchronize = useCallback(
    async (target: string, metadata: AvatarMetadata | null, token: number) => {
      if (!gateway) {
        if (!current(target, token)) return;
        setSyncState(metadata?.syncState ?? null);
        setStatus(metadata?.syncState?.startsWith('pending') ? 'pending' : 'ready');
        return;
      }
      if (!current(target, token)) return;
      setStatus('syncing');
      setError('');
      try {
        if (metadata?.syncState === 'pending-delete') {
          await gateway.remove(target);
          await metadataStore.remove(target);
          if (!current(target, token)) return;
          setSyncState(null);
          setStatus('ready');
          return;
        }
        if (metadata?.syncState === 'pending-upload') {
          if (!metadata.localRef) throw new Error('本机头像文件已丢失，请重新选择');
          const bytes = await privateStore.read(metadata.localRef);
          if (!bytes) throw new Error('本机头像文件已丢失，请重新选择');
          await gateway.upload(target, bytes);
          const synced = { ...metadata, updatedAt: new Date().toISOString(), syncState: 'synced' as const };
          await metadataStore.save(synced);
          if (!current(target, token)) return;
          setSyncState('synced');
          setStatus('ready');
          return;
        }
        const bytes = await gateway.download(target);
        if (!current(target, token)) return;
        if (bytes) {
          await saveRemoteCopy(target, bytes, metadata, token);
          return;
        }
        if (metadata?.localRef) await privateStore.remove(metadata.localRef).catch(() => {});
        await metadataStore.remove(target);
        if (!current(target, token)) return;
        setUri(null);
        setSyncState(null);
        setStatus('ready');
      } catch (reason) {
        if (!current(target, token)) return;
        setSyncState(metadata?.syncState ?? null);
        setStatus(metadata?.syncState?.startsWith('pending') ? 'pending' : 'error');
        setError(friendlyAvatarError(reason));
      }
    },
    [current, gateway, metadataStore, privateStore, saveRemoteCopy],
  );

  const load = useCallback(
    async (target: string, token: number) => {
      try {
        const metadata = await metadataStore.load(target);
        if (!current(target, token)) return;
        if (metadata?.localRef) {
          const resolved = await privateStore.resolve(metadata.localRef);
          if (!current(target, token)) return;
          setUri(resolved);
        } else setUri(null);
        setLoadedOwner(target);
        if (!current(target, token)) return;
        setSyncState(metadata?.syncState ?? null);
        await synchronize(target, metadata, token);
      } catch (reason) {
        if (!current(target, token)) return;
        setLoadedOwner(target);
        setStatus('error');
        setError(friendlyAvatarError(reason));
      }
    },
    [current, metadataStore, privateStore, synchronize],
  );

  useEffect(() => {
    const token = ++generation.current;
    if (ownerKey) void load(ownerKey, token);
  }, [load, ownerKey]);

  useEffect(() => {
    if (!ownerKey) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const token = generation.current;
      void metadataStore.load(ownerKey).then((metadata) => synchronize(ownerKey, metadata, token));
    });
    return () => subscription.remove();
  }, [metadataStore, ownerKey, synchronize]);

  const value = useMemo<AvatarContextValue>(
    () => ({
      uri: ownerKey && loadedOwner === ownerKey ? uri : null,
      status: !ownerKey ? 'guest' : loadedOwner === ownerKey ? status : 'loading',
      syncState: ownerKey && loadedOwner === ownerKey ? syncState : null,
      error: ownerKey && loadedOwner === ownerKey ? error : '',
      async chooseAvatar() {
        const target = ownerRef.current;
        if (!target) throw new Error('请先登录再设置账号头像');
        const token = generation.current;
        setError('');
        try {
          const avatar = await processor.pick();
          if (!avatar || !current(target, token)) return;
          const previous = await metadataStore.load(target);
          const stored = await privateStore.persist(target, avatar);
          const metadata: AvatarMetadata = {
            ownerKey: target,
            localRef: stored.localRef,
            hash: avatar.hash,
            remotePath: avatarRemotePath(target),
            updatedAt: new Date().toISOString(),
            syncState: 'pending-upload',
          };
          await metadataStore.save(metadata);
          if (previous?.localRef && previous.localRef !== stored.localRef)
            await privateStore.remove(previous.localRef).catch(() => {});
          if (!current(target, token)) return;
          setUri(stored.displayUri);
          setLoadedOwner(target);
          setSyncState('pending-upload');
          setStatus('pending');
          await synchronize(target, metadata, token);
        } catch (reason) {
          if (!current(target, token)) return;
          setStatus('error');
          setError(friendlyAvatarError(reason));
          throw reason;
        }
      },
      async deleteAvatar() {
        const target = ownerRef.current;
        if (!target) return;
        const token = generation.current;
        const previous = await metadataStore.load(target);
        const metadata: AvatarMetadata = {
          ownerKey: target,
          localRef: null,
          hash: null,
          remotePath: avatarRemotePath(target),
          updatedAt: new Date().toISOString(),
          syncState: 'pending-delete',
        };
        await metadataStore.save(metadata);
        if (previous?.localRef) await privateStore.remove(previous.localRef).catch(() => {});
        if (!current(target, token)) return;
        setUri(null);
        setLoadedOwner(target);
        setSyncState('pending-delete');
        setStatus('pending');
        await synchronize(target, metadata, token);
      },
      async retry() {
        const target = ownerRef.current;
        if (!target) return;
        const token = generation.current;
        await synchronize(target, await metadataStore.load(target), token);
      },
      async clearLocalOwner(target) {
        const metadata = await metadataStore.load(target);
        if (metadata?.localRef) await privateStore.remove(metadata.localRef).catch(() => {});
        await metadataStore.remove(target);
        if (ownerRef.current === target) {
          setUri(null);
          setLoadedOwner(target);
          setSyncState(null);
          setError('');
          setStatus(auth.session ? 'ready' : 'guest');
        }
      },
    }),
    [
      auth.session,
      current,
      error,
      loadedOwner,
      metadataStore,
      ownerKey,
      privateStore,
      processor,
      status,
      syncState,
      synchronize,
      uri,
    ],
  );

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAccountAvatar(): AvatarContextValue {
  return useContext(AvatarContext);
}
