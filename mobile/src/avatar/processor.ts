import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  AVATAR_JPEG_QUALITY,
  AVATAR_SIZE,
  bytesBuffer,
  bytesToHex,
  type AvatarImageProcessor,
} from './model';

export const avatarPickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
  exif: false,
  base64: false,
  allowsMultipleSelection: false,
};

export const avatarSaveOptions = {
  base64: false,
  compress: AVATAR_JPEG_QUALITY,
  format: SaveFormat.JPEG,
} as const;

export function avatarCrop(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('无法读取所选照片尺寸');
  const edge = Math.min(width, height);
  return {
    originX: Math.round((width - edge) / 2),
    originY: Math.round((height - edge) / 2),
    width: edge,
    height: edge,
  };
}

async function bytesFromUri(uri: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web') return new File(uri).bytes();
  const response = await fetch(uri);
  if (!response.ok) throw new Error('无法读取处理后的头像');
  return new Uint8Array(await response.arrayBuffer());
}

export const avatarImageProcessor: AvatarImageProcessor = {
  async pick() {
    const result = await ImagePicker.launchImageLibraryAsync(avatarPickerOptions);
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const context = ImageManipulator.manipulate(asset.uri);
    context.crop(avatarCrop(asset.width, asset.height)).resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync(avatarSaveOptions);
    const bytes = await bytesFromUri(saved.uri);
    const hash = bytesToHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytesBuffer(bytes)));
    return {
      bytes,
      hash,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      mimeType: 'image/jpeg',
    };
  },
};
