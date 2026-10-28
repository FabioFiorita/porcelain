import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { ReviewGitSettingsStore } from '@porcelain/access/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reviewGitSettingsStoreContract } from '@porcelain/access/store-contracts';

function open(dataDirectory: string) {
  return ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
}

reviewGitSettingsStoreContract('SqliteReviewGitSettingsStore', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = open(dataDirectory);
  return {
    store: await session.runPromise(ReviewGitSettingsStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqliteReviewGitSettingsStore persistence', () => {
  let dataDirectory: string;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  });

  afterEach(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('keeps the settings and revision when the data directory is opened again', async () => {
    const configured = {
      kind: 'configured' as const,
      revision: 4,
      settings: {
        pullStrategy: 'rebase' as const,
        collapseSpecs: true,
        archiveDeleteWorktree: false,
        archiveDeleteLocalBranch: false,
        archiveDeleteRemoteBranch: true,
      },
    };
    const first = open(dataDirectory);
    await Effect.runPromise(
      (await first.runPromise(ReviewGitSettingsStore)).write(configured),
    );
    await first.dispose();

    const second = open(dataDirectory);
    const reopened = await Effect.runPromise(
      (await second.runPromise(ReviewGitSettingsStore)).read(),
    );
    await second.dispose();

    expect(reopened).toEqual(configured);
  });
});
