import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environmentNameStoreContract } from '@porcelain/access/store-contracts';
import { openStorageSession } from '../../index.ts';
import { createEnvironmentNameStore } from './index.ts';

function open(dataDirectory: string) {
  return openStorageSession(dataDirectory, { worktreeIdLength: 32 });
}

environmentNameStoreContract('SqliteEnvironmentNameStore', () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = open(dataDirectory);
  return {
    store: createEnvironmentNameStore(session),
    close: () => {
      session.close();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqliteEnvironmentNameStore persistence', () => {
  let dataDirectory: string;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  });

  afterEach(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('keeps the chosen name when the data directory is opened again', () => {
    const first = open(dataDirectory);
    createEnvironmentNameStore(first).save({ name: 'Workstation' });
    first.close();

    const second = open(dataDirectory);
    const reopened = createEnvironmentNameStore(second).read();
    second.close();

    expect(reopened).toEqual({ name: 'Workstation' });
  });
});
