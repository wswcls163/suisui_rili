import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from '../auth/client';
import { accountOwner } from '../sync/model';
import { AVATAR_BUCKET, avatarRemotePath, type AvatarRemoteGateway } from './model';

function missingObject(error: { message?: string; statusCode?: string | number } | null): boolean {
  return Boolean(
    error &&
    (Number(error.statusCode) === 404 || /object (not found|does not exist)/i.test(error.message ?? '')),
  );
}

export class SupabaseAvatarGateway implements AvatarRemoteGateway {
  constructor(private client: SupabaseClient) {}

  private async assertOwner(ownerKey: string): Promise<string> {
    const session = await this.client.auth.getSession();
    if (session.error) throw session.error;
    const userId = session.data.session?.user.id;
    if (!userId || accountOwner(userId) !== ownerKey) throw new Error('账号会话已经变化，请重新登录');
    return avatarRemotePath(ownerKey);
  }

  async download(ownerKey: string): Promise<Uint8Array | null> {
    const path = await this.assertOwner(ownerKey);
    const { data, error } = await this.client.storage.from(AVATAR_BUCKET).download(path);
    if (missingObject(error)) return null;
    if (error) throw error;
    return new Uint8Array(await data.arrayBuffer());
  }

  async upload(ownerKey: string, bytes: Uint8Array): Promise<void> {
    const path = await this.assertOwner(ownerKey);
    const { error } = await this.client.storage.from(AVATAR_BUCKET).upload(path, bytes, {
      cacheControl: '0',
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
  }

  async remove(ownerKey: string): Promise<void> {
    const path = await this.assertOwner(ownerKey);
    const { error } = await this.client.storage.from(AVATAR_BUCKET).remove([path]);
    if (error && !missingObject(error)) throw error;
  }
}

export const avatarRemoteGateway: AvatarRemoteGateway | null = supabaseClient
  ? new SupabaseAvatarGateway(supabaseClient)
  : null;
