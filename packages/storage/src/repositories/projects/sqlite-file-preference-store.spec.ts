import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { InventoryStore, FilePreferenceStore } from '@porcelain/projects/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filePreferenceStoreContract } from '@porcelain/projects/store-contracts';

filePreferenceStoreContract('SqliteFilePreferenceStore', async (projectIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  await Promise.all(
    projectIds.map(
      async (projectId, position) =>
        await Effect.runPromise(
          (await session.runPromise(InventoryStore)).save({
            id: projectId,
            name: projectId,
            namedByOwner: false,
            commonDirectory: `/repositories/${projectId}/.git`,
            repositoryIdentity: `identity-${projectId}`,
            available: true,
            position,
          }),
        ),
    ),
  );
  return {
    store: await session.runPromise(FilePreferenceStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});
