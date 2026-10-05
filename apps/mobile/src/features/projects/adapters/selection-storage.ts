import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { Schema } from 'effect';
import {
  projectSelectionSnapshotSchema,
  type ProjectSelectionStorage,
} from '@porcelain/client/projects';

const storage = new SQLiteStorage('porcelain-projects.db');
const key = 'selection';

export const projectSelectionStorage: ProjectSelectionStorage = {
  async read() {
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
  async write(snapshot) {
    await storage.setItemAsync(
      key,
      JSON.stringify(
        Schema.encodeSync(projectSelectionSnapshotSchema)(snapshot),
      ),
    );
  },
};
