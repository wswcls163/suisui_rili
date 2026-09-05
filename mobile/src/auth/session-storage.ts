import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;

async function removeChunks(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(`${key}.parts`));
  if (Number.isInteger(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)),
    );
  }
  await Promise.all([SecureStore.deleteItemAsync(key), SecureStore.deleteItemAsync(`${key}.parts`)]);
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const direct = await SecureStore.getItemAsync(key);
    if (direct !== null) return direct;
    const count = Number(await SecureStore.getItemAsync(`${key}.parts`));
    if (!Number.isInteger(count) || count < 1) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)),
    );
    return parts.every((part): part is string => part !== null) ? parts.join('') : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const parts = Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, index) =>
      value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
    try {
      await Promise.all(parts.map((part, index) => SecureStore.setItemAsync(`${key}.${index}`, part)));
      await SecureStore.setItemAsync(`${key}.parts`, String(parts.length));
    } catch (error) {
      await Promise.all([
        ...parts.map((_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)),
        SecureStore.deleteItemAsync(`${key}.parts`),
        SecureStore.deleteItemAsync(key),
      ]);
      throw error;
    }
  },
  removeItem: removeChunks,
};
