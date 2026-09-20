import type {
  GitOrdinaryChange,
  GitStatusObservation,
} from '@porcelain/git/dtos/git-status';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import { RequestGitSession } from '@porcelain/git/git-session';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { describe, expect, it } from 'vitest';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { fakeInspection } from '../testing/fake-inspection.ts';
import { WorktreeChangedError } from './errors/worktree-changed-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { fingerprintChange } from './fingerprint-change.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';
import { ReadChangeDiffs } from './read-change-diffs.ts';
import { ReadWorktreeStatus } from './read-worktree-status.ts';

describe('Worktree inspection use cases', () => {
  const change: GitOrdinaryChange = {
    scope: 'unstaged',
    kind: 'modified',
    oldPath: 'file',
    newPath: 'file',
    oldMode: '100644',
    newMode: '100644',
    oldOid: 'a'.repeat(40),
    newOid: null,
    supported: true,
  };
  const selection = {
    scope: change.scope,
    oldPath: change.oldPath,
    newPath: change.newPath,
  } as const;
  const digests = new Map([
    ['file', { kind: 'file' as const, digest: 'd'.repeat(64), stamp: 'one' }],
  ]);
  const files = async () => new Map(digests);
  /** The index file, which a staged diff reads, is stamped too. */
  const stamp = async () => 'index-stamp';
  /** The fingerprint the list would have published for this observation. */
  const expected = [
    {
      path: 'file',
      fingerprint: fingerprintChange('file', [change], () => ({
        digest: 'd'.repeat(64),
      })),
    },
  ];
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
      return fakeInspection({ readStatus: async () => observation });
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

  /**
   * Detached: there is no upstream to name, so the action UI's two extra
   * processes are not spent. The fake throws on that read to prove it.
   */
  it('reads branch details only when there is a branch', async () => {
    const details = {
      remoteName: 'origin',
      sourceRef: 'refs/heads/main',
      stashes: [],
    };
    const git: InspectionFactory = () =>
      fakeInspection({
        readStatus: async () => ({
          ...observation,
          branch: { name: 'main', upstream: null, ahead: 0, behind: 0 },
        }),
        readBranchDetails: async (branch) => {
          expect(branch).toBe('main');
          return details;
        },
      });
    expect(
      (
        await new ReadWorktreeStatus(store(), worktrees(), git).execute(
          'worktree',
          new RequestGitSession(async () => {}),
        )
      ).status.branch,
    ).toEqual({
      name: 'main',
      upstream: null,
      ahead: 0,
      behind: 0,
      ...details,
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
      new ReadChangeDiffs(store(), worktrees(), git, files, stamp).execute(
        'missing',
        'observed',
        expected,
        [selection],
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  });

  it('rejects stale observations and selections the status does not hold', async () => {
    const git: InspectionFactory = () =>
      fakeInspection({
        readStatus: async () => observation,
        readDiffs: async () => {
          throw new Error('Must not read diffs');
        },
      });
    const operation = new ReadChangeDiffs(
      store(),
      worktrees(),
      git,
      files,
      stamp,
    );
    const session = () => new RequestGitSession(async () => {});
    await expect(
      operation.execute('worktree', 'stale', expected, [selection], session()),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
    await expect(
      operation.execute(
        'worktree',
        'observed',
        expected,
        [{ ...selection, scope: 'staged' }],
        session(),
      ),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
    await expect(
      operation.execute(
        'worktree',
        'observed',
        expected,
        [{ ...selection, newPath: '../outside' }],
        session(),
      ),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
    await expect(
      operation.execute('worktree', 'observed', expected, [], session()),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
  });

  /**
   * One observation, not a transaction: the token in the answer is what the
   * caller must present next, and there is no second status read pretending
   * the worktree held still while the answer was assembled.
   */
  /**
   * The hunks are bound to the fingerprints returned with them, which takes an
   * observation on each side of the read: one to check the request against,
   * and one to say the content did not move while Git was reading it.
   */
  it('reads the status on both sides of the hunks it returns', async () => {
    const order: string[] = [];
    const git: InspectionFactory = () =>
      fakeInspection({
        readStatus: async () => {
          order.push('status');
          return observation;
        },
        readDiffs: async () => {
          order.push('diffs');
          return [{ kind: 'binary' }];
        },
      });
    expect(
      await new ReadChangeDiffs(
        store(),
        worktrees(),
        git,
        files,
        stamp,
      ).execute(
        'worktree',
        'observed',
        expected,
        [selection],
        new RequestGitSession(async () => {}),
      ),
    ).toEqual({
      environmentId: 'environment',
      worktreeId: 'worktree',
      statusToken: 'observed',
      diffs: [{ selection, content: { kind: 'binary' } }],
    });
    expect(order).toEqual(['status', 'diffs', 'status']);
  });

  it('refuses hunks whose content moved while they were being read', async () => {
    let read = false;
    const git: InspectionFactory = () =>
      fakeInspection({
        readStatus: async () => observation,
        readDiffs: async () => {
          read = true;
          return [{ kind: 'binary' }];
        },
      });
    // The working side digests differently the second time it is looked at.
    let looks = 0;
    const moving = async () => {
      looks += 1;
      return new Map([
        [
          'file',
          {
            kind: 'file' as const,
            digest: (looks > 1 ? 'e' : 'd').repeat(64),
            stamp: 'one',
          },
        ],
      ]);
    };
    await expect(
      new ReadChangeDiffs(store(), worktrees(), git, moving, stamp).execute(
        'worktree',
        'observed',
        expected,
        [selection],
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(WorktreeChangedError);
    // It got as far as reading them, and still refused to hand them over.
    expect(read).toBe(true);
  });

  /**
   * The diffs are about to leave the process, so the checkout they came from
   * is confirmed first — through the resolver, which reads identity from the
   * filesystem and costs no Git process.
   */
  it('refuses to return diffs from a checkout that stopped being reachable', async () => {
    let reachable = true;
    const git: InspectionFactory = () =>
      fakeInspection({
        readStatus: async () => observation,
        readDiffs: async () => {
          reachable = false;
          return [{ kind: 'binary' }];
        },
      });
    await expect(
      new ReadChangeDiffs(
        store(),
        fakeWorktrees(
          [{ id: 'worktree', path: '/fixture', metadataIdentity: 'identity' }],
          { projectAvailable: () => reachable },
        ),
        git,
        files,
        stamp,
      ).execute(
        'worktree',
        'observed',
        expected,
        [selection],
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toBeInstanceOf(RepositoryIdentityMismatchError);
  });

  it('honors cancellation after adapter reads', async () => {
    const controller = new AbortController();
    const cancelling: InspectionFactory = () =>
      fakeInspection({
        readStatus: async () => {
          controller.abort();
          return observation;
        },
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
      return fakeInspection({
        readStatus: async () => {
          await checkout.verify();
          return observation;
        },
        readDiffs: async () => [{ kind: 'binary' }],
      });
    };
    const status = new ReadWorktreeStatus(store(), worktrees(), git);
    const diffs = new ReadChangeDiffs(store(), worktrees(), git, files, stamp);
    await status.execute('worktree', session);
    await diffs.execute('worktree', 'observed', expected, [selection], session);
    // Two use cases, two readers, one guarded checkout.
    expect(readers).toBe(2);
    expect(verified).toEqual(['/fixture']);
  });
});
