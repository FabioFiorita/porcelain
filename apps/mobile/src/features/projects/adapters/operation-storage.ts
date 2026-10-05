import { SQLiteStorage } from 'expo-sqlite/kv-store';

const storage = new SQLiteStorage('porcelain-git-operations.db');

export const operationStorage = {
  getItem: (key: string) => storage.getItemSync(key),
  setItem: (key: string, value: string) => storage.setItemSync(key, value),
  removeItem: (key: string) => storage.removeItemSync(key),
};
