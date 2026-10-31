import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { EnvironmentLabelStore } from '@porcelain/access/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environmentLabelStoreContract } from '@porcelain/access/store-contracts';

function open(dataDirectory: string) {
  return ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
}

environmentLabelStoreContract('SqliteEnvironmentLabelStore', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = open(dataDirectory);
  return {
    store: await session.runPromise(EnvironmentLabelStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqliteEnvironmentLabelStore persistence', () => {
  let dataDirectory: string;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  });

  afterEach(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('keeps the chosen name and icon when the data directory is opened again', async () => {
    const first = open(dataDirectory);
    await Effect.runPromise(
      (await first.runPromise(EnvironmentLabelStore)).save({
        name: 'Workstation',
        icon: 'laptop',
      }),
    );
    await first.dispose();

    const second = open(dataDirectory);
    const reopened = await Effect.runPromise(
      (await second.runPromise(EnvironmentLabelStore)).read(),
    );
    await second.dispose();

    expect(reopened).toEqual({ name: 'Workstation', icon: 'laptop' });
  });
});
