import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openStorageSession } from '../../index.ts';
import { createInventoryStore } from '../projects/index.ts';
import { createEnvironmentIdentityStore } from './index.ts';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function open(dataDirectory: string) {
  return openStorageSession(dataDirectory, {
    worktreeId: (projectId, metadataIdentity) =>
      `${projectId}:${metadataIdentity}`,
  });
}

describe('EnvironmentIdentityRepository', () => {
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
      createEnvironmentIdentityStore(session).environmentId();
    session.close();

    expect(environmentId).toMatch(uuid);
  });

  it('keeps the identity when the data directory is opened again', () => {
    const first = open(dataDirectory);
    const created = createEnvironmentIdentityStore(first).environmentId();
    first.close();

    const second = open(dataDirectory);
    const reopened = createEnvironmentIdentityStore(second).environmentId();
    second.close();

    expect(reopened).toBe(created);
  });

  it('gives each data directory its own identity', () => {
    const otherDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    const first = open(dataDirectory);
    const other = open(otherDirectory);
    const identities = [
      createEnvironmentIdentityStore(first).environmentId(),
      createEnvironmentIdentityStore(other).environmentId(),
    ];
    first.close();
    other.close();
    rmSync(otherDirectory, { recursive: true, force: true });

    expect(identities[0]).not.toBe(identities[1]);
  });

  it('reports the same identity in the inventory', () => {
    const session = open(dataDirectory);
    const environmentId =
      createEnvironmentIdentityStore(session).environmentId();
    const inventory = createInventoryStore(session).read();
    session.close();

    expect(inventory).toEqual({ environmentId, projects: [] });
  });
});
