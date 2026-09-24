import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environmentIdentityReaderContract } from '@porcelain/access/store-contracts';
import { openStorageSession } from '../../index.ts';
import { createEnvironmentIdentityReader } from './index.ts';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function open(dataDirectory: string) {
  return openStorageSession(dataDirectory, { worktreeIdLength: 32 });
}

environmentIdentityReaderContract('SqliteEnvironmentIdentityReader', () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = open(dataDirectory);
  return {
    store: createEnvironmentIdentityReader(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqliteEnvironmentIdentityReader persistence', () => {
  let dataDirectory: string;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  });

  afterEach(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('has a random identity as soon as a new data directory is opened', () => {
    const session = open(dataDirectory);
    const environmentId =
      createEnvironmentIdentityReader(session).environmentId();
    session.close();

    expect(environmentId).toMatch(uuid);
  });

  it('keeps the identity when the data directory is opened again', () => {
    const first = open(dataDirectory);
    const created = createEnvironmentIdentityReader(first).environmentId();
    first.close();

    const second = open(dataDirectory);
    const reopened = createEnvironmentIdentityReader(second).environmentId();
    second.close();

    expect(reopened).toBe(created);
  });

  it('gives each data directory its own identity', () => {
    const otherDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    const first = open(dataDirectory);
    const other = open(otherDirectory);
    const identities = [
      createEnvironmentIdentityReader(first).environmentId(),
      createEnvironmentIdentityReader(other).environmentId(),
    ];
    first.close();
    other.close();
    rmSync(otherDirectory, { recursive: true, force: true });

    expect(identities[0]).not.toBe(identities[1]);
  });
});
