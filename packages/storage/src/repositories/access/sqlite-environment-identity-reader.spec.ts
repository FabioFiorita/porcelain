import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { EnvironmentIdentityReader } from '@porcelain/access/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environmentIdentityReaderContract } from '@porcelain/access/store-contracts';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function open(dataDirectory: string) {
  return ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
}

environmentIdentityReaderContract(
  'SqliteEnvironmentIdentityReader',
  async () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    const session = open(dataDirectory);
    return {
      store: await session.runPromise(EnvironmentIdentityReader),
      close: async () => {
        await session.dispose();
        rmSync(dataDirectory, { recursive: true, force: true });
      },
    };
  },
);

describe('SqliteEnvironmentIdentityReader persistence', () => {
  let dataDirectory: string;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  });

  afterEach(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('has a random identity as soon as a new data directory is opened', async () => {
    const session = open(dataDirectory);
    const environmentId = await Effect.runPromise(
      (await session.runPromise(EnvironmentIdentityReader)).environmentId(),
    );
    await session.dispose();

    expect(environmentId).toMatch(uuid);
  });

  it('keeps the identity when the data directory is opened again', async () => {
    const first = open(dataDirectory);
    const created = await Effect.runPromise(
      (await first.runPromise(EnvironmentIdentityReader)).environmentId(),
    );
    await first.dispose();

    const second = open(dataDirectory);
    const reopened = await Effect.runPromise(
      (await second.runPromise(EnvironmentIdentityReader)).environmentId(),
    );
    await second.dispose();

    expect(reopened).toBe(created);
  });

  it('gives each data directory its own identity', async () => {
    const otherDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    const first = open(dataDirectory);
    const other = open(otherDirectory);
    const identities = [
      await Effect.runPromise(
        (await first.runPromise(EnvironmentIdentityReader)).environmentId(),
      ),
      await Effect.runPromise(
        (await other.runPromise(EnvironmentIdentityReader)).environmentId(),
      ),
    ];
    await first.dispose();
    await other.dispose();
    rmSync(otherDirectory, { recursive: true, force: true });

    expect(identities[0]).toMatch(uuid);
    expect(identities[1]).toMatch(uuid);
    expect(identities[0]).not.toBe(identities[1]);
  });
});
