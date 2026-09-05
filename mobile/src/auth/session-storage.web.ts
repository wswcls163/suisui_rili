const memory = new Map<string, string>();

function browserStorage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return browserStorage()?.getItem(key) ?? memory.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const storage = browserStorage();
    if (storage) storage.setItem(key, value);
    else memory.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    browserStorage()?.removeItem(key);
    memory.delete(key);
  },
};
