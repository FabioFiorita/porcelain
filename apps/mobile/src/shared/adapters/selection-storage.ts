import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { Cause, Effect, Schema } from 'effect';
import {
  projectSelectionSnapshotSchema,
  ProjectSelectionStorage,
} from '@porcelain/client/projects';

const storage = new SQLiteStorage('porcelain-projects.db');
const key = 'selection';

export const projectSelectionStorage = ProjectSelectionStorage.of({
  read: () =>
    Effect.tryPromise({
      try: async () => {
        const value = await storage.getItemAsync(key);
        if (value === null)
          return { currentEnvironmentId: undefined, selections: {} };
        const saved = Schema.decodeUnknownSync(projectSelectionSnapshotSchema)(
          JSON.parse(value),
        );
        return {
          currentEnvironmentId: saved.currentEnvironmentId,
          selections: saved.selections,
        };
      },
      catch: (cause) => new Cause.UnknownError(cause),
    }),
  write: (snapshot) =>
    Effect.tryPromise({
      try: async () => {
        await storage.setItemAsync(
          key,
          JSON.stringify(
            Schema.encodeSync(projectSelectionSnapshotSchema)(snapshot),
          ),
        );
      },
      catch: (cause) => new Cause.UnknownError(cause),
    }),
});
