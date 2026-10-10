import { Directory, File, Paths } from 'expo-file-system';
import { avatarLocalRef, type AvatarPrivateStore } from './model';

const directory = new Directory(Paths.document, 'account-avatars');

function safeRef(localRef: string): string {
  if (!/^[a-z0-9-]+-[a-f0-9]{16}\.jpg$/i.test(localRef)) throw new Error('头像本地引用无效');
  return localRef;
}

function file(localRef: string): File {
  return new File(directory, safeRef(localRef));
}

export const avatarPrivateStore: AvatarPrivateStore = {
  async persist(ownerKey, avatar) {
    if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
    const localRef = avatarLocalRef(ownerKey, avatar.hash);
    const target = file(localRef);
    target.write(avatar.bytes);
    return { localRef, displayUri: target.uri };
  },
  async resolve(localRef) {
    const target = file(localRef);
    return target.exists ? target.uri : null;
  },
  async read(localRef) {
    const target = file(localRef);
    return target.exists ? target.bytes() : null;
  },
  async remove(localRef) {
    const target = file(localRef);
    if (target.exists) target.delete();
  },
};
