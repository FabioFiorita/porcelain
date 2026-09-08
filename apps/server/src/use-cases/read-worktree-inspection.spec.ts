import type {
  GitOrdinaryChange,
  GitStatusObservation,
} from '@porcelain/git/dtos/git-status';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { expect, it } from 'vitest';
import type { Inventory } from '../models/inventory.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { ReadWorktreeDiff } from './read-worktree-diff.ts';
import { ReadWorktreeStatus } from './read-worktree-status.ts';

const change: GitOrdinaryChange = {
  scope: 'unstaged',
  kind: 'modified',
  oldPath: 'file',
  newPath: 'file',
  oldMode: '100644',
  newMode: '100644',
  supported: true,
};
const observation: GitStatusObservation = {
  statusToken: 'observed',
  headOid: null,
  changes: [change],
};
function store(available = true): InventoryStore {
  const inventory: Inventory = {
    environmentId: 'environment',
    projects: [
      {
        id: 'project',
        name: 'project',
        commonDirectory: '/fixture/.git',
        repositoryIdentity: 'repository',
        available,
        worktrees: [
          {
            id: 'worktree',
            path: '/fixture',
            metadataIdentity: 'identity',
            main: true,
            branch: null,
            available,
          },
        ],
      },
    ],
  };
  return {
    read: () => inventory,
    save: () => {
      throw new Error('Read must not write inventory');
    },
  };
}

it('returns status using the registered checkout and identity with typed adapters', async () => {
  const git: InspectionFactory = (checkout, identity, repositoryIdentity) => {
    expect({ checkout, identity, repositoryIdentity }).toEqual({
      checkout: '/fixture',
      identity: 'identity',
      repositoryIdentity: 'repository',
    });
    return {
      readStatus: async () => observation,
      readDiff: async () => ({ kind: 'binary' }),
    };
  };
  expect(
    await new ReadWorktreeStatus(store(), git).execute('worktree'),
  ).toEqual({
    environmentId: 'environment',
    worktreeId: 'worktree',
    status: observation,
  });
});

it('rejects missing and unavailable worktrees before inspecting them', async () => {
  const git: InspectionFactory = () => {
    throw new Error('Must not inspect');
  };
  await expect(
    new ReadWorktreeStatus(store(), git).execute('missing'),
  ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  await expect(
    new ReadWorktreeStatus(store(false), git).execute('worktree'),
  ).rejects.toBeInstanceOf(RepositoryIdentityMismatchError);
  await expect(
    new ReadWorktreeDiff(store(), git).execute('missing', 'observed', change),
  ).rejects.toBeInstanceOf(WorktreeNotFoundError);
});

it('rejects stale observations and paths not present in the selected comparison', async () => {
  const git: InspectionFactory = () => ({
    readStatus: async () => observation,
    readDiff: async () => {
      throw new Error('Must not read diff');
    },
  });
  const operation = new ReadWorktreeDiff(store(), git);
  await expect(
    operation.execute('worktree', 'stale', change),
  ).rejects.toBeInstanceOf(WorktreeChangedError);
  await expect(
    operation.execute('worktree', 'observed', { ...change, scope: 'staged' }),
  ).rejects.toBeInstanceOf(WorktreeChangedError);
  await expect(
    operation.execute('worktree', 'observed', {
      ...change,
      newPath: '../outside',
    }),
  ).rejects.toBeInstanceOf(WorktreeChangedError);
});

it('rejects detected drift after generating a diff instead of returning mismatched content', async () => {
  let current = observation;
  const git: InspectionFactory = () => ({
    readStatus: async () => current,
    readDiff: async () => {
      current = { ...observation, statusToken: 'changed' };
      return { kind: 'text', patch: 'untrusted result' };
    },
  });
  await expect(
    new ReadWorktreeDiff(store(), git).execute('worktree', 'observed', change),
  ).rejects.toBeInstanceOf(WorktreeChangedError);
});

it('returns a selected result when observations agree and honors cancellation after adapter reads', async () => {
  const controller = new AbortController();
  const git: InspectionFactory = () => ({
    readStatus: async () => observation,
    readDiff: async () => ({ kind: 'binary' }),
  });
  expect(
    await new ReadWorktreeDiff(store(), git).execute(
      'worktree',
      'observed',
      change,
    ),
  ).toMatchObject({
    environmentId: 'environment',
    worktreeId: 'worktree',
    change,
    content: { kind: 'binary' },
  });
  const cancelling: InspectionFactory = () => ({
    readStatus: async () => {
      controller.abort();
      return observation;
    },
    readDiff: async () => ({ kind: 'binary' }),
  });
  await expect(
    new ReadWorktreeStatus(store(), cancelling).execute(
      'worktree',
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
