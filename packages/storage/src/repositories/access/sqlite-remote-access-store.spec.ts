import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { RemoteAccessStore } from '@porcelain/access/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { remoteAccessStoreContract } from '@porcelain/access/store-contracts';

function open(dataDirectory: string) {
  return ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
}

remoteAccessStoreContract('SqliteRemoteAccessStore', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = open(dataDirectory);
  return {
    store: await session.runPromise(RemoteAccessStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqliteRemoteAccessStore persistence', () => {
  let dataDirectory: string;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  });

  afterEach(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('keeps the chosen routes when the data directory is opened again', async () => {
    const first = open(dataDirectory);
    await Effect.runPromise(
      (await first.runPromise(RemoteAccessStore)).save({
        lan: true,
        tailnet: true,
        tailnetHostname: 'laptop.tail0000.ts.net',
        tailnetPort: 41000,
        cloudflare: true,
        cloudflareHostname: 'porcelain.example.com',
      }),
    );
    await first.dispose();

    const second = open(dataDirectory);
    const reopened = await Effect.runPromise(
      (await second.runPromise(RemoteAccessStore)).read(),
    );
    await second.dispose();

    expect(reopened).toEqual({
      lan: true,
      tailnet: true,
      tailnetHostname: 'laptop.tail0000.ts.net',
      tailnetPort: 41000,
      cloudflare: true,
      cloudflareHostname: 'porcelain.example.com',
    });
  });
});
