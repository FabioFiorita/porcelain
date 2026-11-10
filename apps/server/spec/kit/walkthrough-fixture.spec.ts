import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Layer, ManagedRuntime } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it } from 'vitest';
import { storageLayer } from '@porcelain/storage';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import { seedStoredWalkthroughs } from './walkthrough-fixture.ts';

const legacy: WalkthroughJob = {
  worktreePath: '/fixture',
  patch: '',
  files: [],
  run: {
    id: 'legacy',
    projectId: 'project',
    worktreeId: 'worktree',
    headOid: 'head',
    baseOid: 'base',
    baseRef: 'refs/heads/main',
    contentTreeOid: 'base',
    includesUncommitted: false,
    pullRequestNumber: 42,
    writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
    createdAt: '2026-11-09T00:00:00.000Z',
    state: { status: 'queued' },
  },
};
it('rolls back every seeded row when a stored fixture cannot be committed', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'walkthrough-fixture-atomic-'));
  const runtime = ManagedRuntime.make(
    storageLayer(directory, { worktreeIdLength: 32, busyTimeoutMs: 5000 }).pipe(
      Layer.provide(NodeServices.layer),
    ),
  );
  try {
    await runtime.runPromise(WalkthroughStore);
    const asset = {
      runId: 'legacy',
      id: 'duplicate',
      mediaType: 'image/png',
      caption: 'Fixture',
      bytes: new Uint8Array([1]),
    };
    expect(() =>
      seedStoredWalkthroughs(directory, {
        jobs: [legacy],
        assets: [asset, asset],
      }),
    ).toThrow();
    const store = await runtime.runPromise(WalkthroughStore);
    expect(await runtime.runPromise(store.readJob('legacy'))).toBeUndefined();
    expect(
      await runtime.runPromise(
        store.readAsset('legacy', 'duplicate', 'worktree'),
      ),
    ).toBeUndefined();
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
