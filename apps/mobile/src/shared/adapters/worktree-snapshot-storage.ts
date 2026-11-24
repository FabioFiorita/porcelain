import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { Effect } from 'effect';
import { WorktreeSnapshotStorage } from '@porcelain/client/projects';

const storage = new SQLiteStorage('porcelain-worktrees.db');

export const worktreeSnapshotStorage = WorktreeSnapshotStorage.of({
  read: (environmentId) =>
    Effect.tryPromise(() => storage.getItemAsync(environmentId)),
  write: (environmentId, snapshot) =>
    Effect.tryPromise(() => storage.setItemAsync(environmentId, snapshot)),
  remove: (environmentId) =>
    Effect.tryPromise(() => storage.removeItemAsync(environmentId)).pipe(
      Effect.asVoid,
    ),
});
