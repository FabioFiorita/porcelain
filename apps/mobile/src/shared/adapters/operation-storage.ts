import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { Effect } from 'effect';
import { OperationStorage } from '@porcelain/client/git-actions';

const storage = new SQLiteStorage('porcelain-git-operations.db');

export function operationStorage(key: string) {
  return OperationStorage.of({
    read: () => Effect.try(() => storage.getItemSync(key)),
    write: (value) => Effect.try(() => storage.setItemSync(key, value)),
    clear: () => Effect.try(() => storage.removeItemSync(key)),
  });
}
