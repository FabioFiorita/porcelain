import type {
  GitOrdinaryChange,
  GitStatusObservation,
} from '@porcelain/git/dtos/git-status';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import { RequestGitSession } from '@porcelain/git/git-session';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { describe, expect, it } from 'vitest';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';
import { ReadWorktreeDiff } from './read-worktree-diff.ts';
import { ReadWorktreeStatus } from './read-worktree-status.ts';

describe('Worktree inspection use cases', () => {
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
    return {
      read: () => ({
        environmentId: 'environment',
        projects: [
          {
            id: 'project',
            name: 'project',
            namedByOwner: false,
            commonDirectory: '/fixture/.git',
            repositoryIdentity: 'repository',
            available,
          },
        ],
      }),
      save: () => {
        throw new Error('Read must not write inventory');
      },
    };
  }

  /** Worktrees come from Git now, so resolution is what decides them. */
  function worktrees(available = true) {
    return fakeWorktrees(
      [
        {
          id: 'worktree',
          path: '/fixture',
          metadataIdentity: 'identity',
          main: true,
          available,
        },
      ],
      { projectAvailable: available },
    );
  }

  it('returns status using the registered checkout and identity with typed adapters', async () => {
    const git: InspectionFactory = (checkout) => {
      expect(checkout.path).toBe('/fixture');
      return {
        readStatus: async () => observation,
        readDiff: async () => ({ kind: 'binary' }),
        readDiffs: async () => [],
      };
    };
    expect(
      await new ReadWorktreeStatus(store(), worktrees(), git).execute(
        'worktree',
        new RequestGitSession(async () => {}),
      ),
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
      new ReadWorktreeStatus(store(), worktrees(), git).execute(
        'missing',
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(WorktreeNotFoundError);
    await expect(
      new ReadWorktreeStatus(store(false), worktrees(false), git).execute(
        'worktree',
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(RepositoryIdentityMismatchError);
    await expect(
      new ReadWorktreeDiff(store(), worktrees(), git).execute(
        'missing',
        'observed',
        change,
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  });

  it('rejects stale observations and paths not present in the selected comparison', async () => {
    const git: InspectionFactory = () => ({
      readStatus: async () => observation,
      readDiff: async () => {
        throw new Error('Must not read diff');
      },
      readDiffs: async () => [],
    });
    const operation = new ReadWorktreeDiff(store(), worktrees(), git);
    await expect(
      operation.execute(
        'worktree',
        'stale',
        change,
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
    await expect(
      operation.execute(
        'worktree',
        'observed',
        { ...change, scope: 'staged' },
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
    await expect(
      operation.execute(
        'worktree',
        'observed',
        { ...change, newPath: '../outside' },
        new RequestGitSession(async () => {}),
      ),
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
      readDiffs: async () => [],
    });
    await expect(
      new ReadWorktreeDiff(store(), worktrees(), git).execute(
        'worktree',
        'observed',
        change,
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
  });

  it('returns a selected result when observations agree and honors cancellation after adapter reads', async () => {
    const controller = new AbortController();
    const git: InspectionFactory = () => ({
      readStatus: async () => observation,
      readDiff: async () => ({ kind: 'binary' }),
      readDiffs: async () => [],
    });
    expect(
      await new ReadWorktreeDiff(store(), worktrees(), git).execute(
        'worktree',
        'observed',
        change,
        new RequestGitSession(async () => {}),
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
      readDiffs: async () => [],
    });
    await expect(
      new ReadWorktreeStatus(store(), worktrees(), cancelling).execute(
        'worktree',
        new RequestGitSession(async () => {}),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('verifies a checkout once for a request that reads it several times', async () => {
    const verified: string[] = [];
    const session = new RequestGitSession(async (checkout) => {
      verified.push(checkout);
    });
    let readers = 0;
    const git: InspectionFactory = (checkout) => {
      readers += 1;
      return {
        readStatus: async () => {
          await checkout.verify();
          return observation;
        },
        readDiff: async () => ({ kind: 'binary' }),
        readDiffs: async () => [],
      };
    };
    const status = new ReadWorktreeStatus(store(), worktrees(), git);
    const diff = new ReadWorktreeDiff(store(), worktrees(), git);
    await status.execute('worktree', session);
    await diff.execute('worktree', 'observed', change, session);
    // Two use cases, two readers, one guarded checkout.
    expect(readers).toBe(2);
    expect(verified).toEqual(['/fixture']);
  });
});
