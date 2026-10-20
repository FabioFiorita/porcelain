import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it } from 'vitest';
import { GitHubAccountStore } from '@porcelain/reviews/ports';
import { InventoryStore } from '@porcelain/projects/ports';
import { storageLayer } from '../../index.ts';
it('persists project choices across reopen, clears overrides, isolates projects and cascades on removal', async ({
  onTestFinished,
}) => {
  const folder = await mkdtemp(join(tmpdir(), 'porcelain-github-store-'));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  const open = () =>
    ManagedRuntime.make(
      storageLayer(folder, { worktreeIdLength: 32, busyTimeoutMs: 5000 }).pipe(
        Layer.provide(NodeServices.layer),
      ),
    );
  const first = open();
  try {
    await first.runPromise(
      Effect.gen(function* () {
        const inventory = yield* InventoryStore;
        yield* inventory.save({
          id: 'project',
          name: 'Project',
          namedByOwner: false,
          commonDirectory: '/repo/.git',
          repositoryIdentity: 'repo',
          available: true,
          position: 0,
        });
        const store = yield* GitHubAccountStore;
        yield* store.detect({
          projectId: 'project',
          repository: 'a/b',
          account: 'personal',
        });
        yield* store.override({
          projectId: 'project',
          repository: 'a/b',
          account: 'work',
        });
        yield* store.detect({
          projectId: 'project',
          repository: 'a/b',
          account: 'personal',
        });
      }),
    );
  } finally {
    await first.dispose();
  }
  const second = open();
  try {
    const store = await second.runPromise(GitHubAccountStore);
    expect(
      await Effect.runPromise(store.read({ projectId: 'project' })),
    ).toEqual({ repository: 'a/b', detected: 'personal', override: 'work' });
    expect(
      await Effect.runPromise(store.read({ projectId: 'other' })),
    ).toBeUndefined();
    await Effect.runPromise(
      store.override({
        projectId: 'project',
        repository: 'a/b',
        account: undefined,
      }),
    );
    expect(
      await Effect.runPromise(store.read({ projectId: 'project' })),
    ).toEqual({ repository: 'a/b', detected: undefined, override: undefined });
    await second.runPromise(
      Effect.flatMap(InventoryStore, (inventory) =>
        inventory.remove({ projectId: 'project' }),
      ),
    );
    expect(
      await Effect.runPromise(store.read({ projectId: 'project' })),
    ).toBeUndefined();
  } finally {
    await second.dispose();
  }
});
