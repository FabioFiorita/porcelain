import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { z } from 'zod';
import {
  readInventoryResponseSchema,
  renameProjectParamsSchema,
} from '@porcelain/contracts/projects';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { ProjectSelectionStorage } from '@porcelain/client/projects';

const storage = new SQLiteStorage('porcelain-projects.db');
const key = 'selection';
const snapshotSchema = z.object({
  currentEnvironmentId:
    readInventoryResponseSchema.shape.environmentId.optional(),
  selections: z.record(
    readInventoryResponseSchema.shape.environmentId,
    z.object({
      projectId: renameProjectParamsSchema.shape.projectId,
      worktreeId: worktreeParamsSchema.shape.worktreeId,
    }),
  ),
});

export const projectSelectionStorage: ProjectSelectionStorage = {
  async read() {
    const value = await storage.getItemAsync(key);
    if (value === null)
      return { currentEnvironmentId: undefined, selections: {} };
    const saved = snapshotSchema.parse(JSON.parse(value));
    return {
      currentEnvironmentId: saved.currentEnvironmentId,
      selections: saved.selections,
    };
  },
  async write(snapshot) {
    await storage.setItemAsync(
      key,
      JSON.stringify(snapshotSchema.parse(snapshot)),
    );
  },
};
