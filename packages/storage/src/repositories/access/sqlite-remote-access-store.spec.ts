import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { remoteAccessStoreContract } from '@porcelain/access/store-contracts';
import { openStorageSession } from '../../index.ts';
import { createRemoteAccessStore } from './index.ts';

function open(dataDirectory: string) {
  return openStorageSession(dataDirectory, {
    worktreeIdLength: 32,
    busyTimeoutMs: 5000,
  });
}

remoteAccessStoreContract('SqliteRemoteAccessStore', () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = open(dataDirectory);
  return {
    store: createRemoteAccessStore(session),
    close: () => {
      session.close();
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

  it('keeps the chosen routes when the data directory is opened again', () => {
    const first = open(dataDirectory);
    createRemoteAccessStore(first).save({
      lan: true,
      tailnet: true,
      tailnetHostname: 'laptop.tail0000.ts.net',
      tailnetPort: 41000,
      cloudflare: true,
      cloudflareHostname: 'porcelain.example.com',
    });
    first.close();

    const second = open(dataDirectory);
    const reopened = createRemoteAccessStore(second).read();
    second.close();

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
