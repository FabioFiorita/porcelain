import type { GitChange } from '@porcelain/git/dtos/git-status';
import { RequestGitSession } from '@porcelain/git/git-session';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import { describe, expect, it } from 'vitest';
import { CommitDrafts } from './commit-drafts.ts';
import { fingerprintChange } from './fingerprint-change.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';
import { PrepareGitAction } from './prepare-git-action.ts';
import { ReadChangeDiffs } from './read-change-diffs.ts';
import { ReadWorktreeChanges } from './read-worktree-changes.ts';
import { SetReviewedFile } from './set-reviewed-file.ts';

/**
 * A checkout can be swapped after a request's first verification. Nothing
 * derived from it may then be kept, stored, or sent on without the identity
 * being confirmed again, so each owner of an escape refuses at that boundary.
 */
const observation = {
  statusToken: 'a'.repeat(64),
  headOid: 'b'.repeat(40),
  changes: [
    {
      scope: 'staged' as const,
      kind: 'modified' as const,
      oldPath: 'file.ts',
      newPath: 'file.ts',
      oldMode: '100644',
      newMode: '100644',
      oldOid: 'c'.repeat(40),
      newOid: 'd'.repeat(40),
      supported: true,
    },
  ],
};

function store() {
  return {
    read: () => ({
      environmentId: 'environment',
      projects: [
        { id: 'project', available: true, repositoryIdentity: 'repository' },
      ],
    }),
  } as never;
}

/** The staged change is whole from the status alone, so no working side. */
const stagedFingerprint = fingerprintChange(
  'file.ts',
  [observation.changes[0] as GitChange],
  () => undefined,
);

const stamp = async () => 'index-stamp';

const worktrees = (reachable: () => boolean = () => true) =>
  fakeWorktrees(
    [
      {
        id: 'worktree',
        path: '/fixture',
        metadataIdentity: 'metadata',
        main: true,
      },
    ],
    { projectAvailable: reachable },
  );

/**
 * A checkout swapped mid-request: the first `passes` verifications succeed and
 * every later one fails, so a test can name exactly which boundary it reaches.
 */
function swappedAfterFirstRead(passes = 1) {
  let verifications = 0;
  const session: GitSession = new RequestGitSession(async () => {
    verifications += 1;
    if (verifications > passes) throw new Error('identity changed');
  });
  return { session, verifications: () => verifications };
}

function inspection(onRead: () => void = () => {}) {
  return (checkout: { verify: (signal?: AbortSignal) => Promise<void> }) =>
    ({
      // The real reader verifies before its first read; the fake must too.
      readStatus: async (signal?: AbortSignal) => {
        await checkout.verify(signal);
        onRead();
        return observation;
      },
      readDiff: async () => ({ kind: 'text' as const, patch: '@@' }),
      readDiffs: async () => [{ kind: 'text' as const, patch: '@@' }],
      hashWorktreeFiles: async () => new Map<string, string>(),
    }) as never;
}

function changesReader(resolver = worktrees(), onRead: () => void = () => {}) {
  return new ReadWorktreeChanges(
    store(),
    resolver,
    inspection(onRead),
    async () => new Map(),
  );
}

describe('escape-point confirmation', () => {
  it('does not return a change list whose checkout can no longer be confirmed', async () => {
    // The identity guard passes; the checkout stops being the registered one
    // only after the status has been read, which is the window this closes.
    let reachable = true;
    const operation = changesReader(
      worktrees(() => reachable),
      () => {
        reachable = false;
      },
    );
    await expect(
      operation.execute('worktree', new RequestGitSession(async () => {})),
    ).rejects.toThrow();
    // Nothing was kept: a later request over a reachable checkout answers.
    reachable = true;
    const result = await changesReader().execute(
      'worktree',
      new RequestGitSession(async () => {}),
    );
    expect(result.changes).toHaveLength(1);
  });

  it('does not return diffs whose checkout can no longer be confirmed', async () => {
    let reachable = true;
    const operation = new ReadChangeDiffs(
      store(),
      worktrees(() => reachable),
      inspection(() => {
        reachable = false;
      }),
      async () => new Map(),
      stamp,
    );
    await expect(
      operation.execute(
        'worktree',
        observation.statusToken,
        [{ path: 'file.ts', fingerprint: stagedFingerprint }],
        [{ scope: 'staged', oldPath: 'file.ts', newPath: 'file.ts' }],
        new RequestGitSession(async () => {}),
      ),
    ).rejects.toThrow();
  });

  it('does not store a mark whose checkout can no longer be confirmed', async () => {
    // The fingerprint a client would have from an earlier read, so the mark
    // reaches the confirmation instead of failing as a stale mark first.
    const observed = (
      await changesReader().execute(
        'worktree',
        new RequestGitSession(async () => {}),
      )
    ).changes[0]?.fingerprint;
    expect(observed).toEqual(expect.any(String));
    const { session } = swappedAfterFirstRead();
    const written: string[] = [];
    const reviewed = {
      hasWorktree: () => true,
      set: (_worktree: string, path: string) => written.push(path),
    } as never;
    const operation = new SetReviewedFile(
      reviewed,
      worktrees(),
      changesReader(),
      { execute: async () => ({ marks: [] }) } as never,
    );
    await expect(
      operation.execute(
        'worktree',
        { path: 'file.ts', reviewed: true, fingerprint: observed as string },
        session,
      ),
    ).rejects.toThrow();
    expect(written).toEqual([]);
  });

  it('does not save an action preview whose checkout can no longer be confirmed', async () => {
    const { session } = swappedAfterFirstRead();
    const saved: unknown[] = [];
    const actions = {
      isBlocked: () => false,
      blockProject: () => undefined,
      savePreparation: (preparation: unknown) => saved.push(preparation),
    } as never;
    const operation = new PrepareGitAction(
      store(),
      worktrees(),
      actions,
      (checkout: { verify: (signal?: AbortSignal) => Promise<void> }) => ({
        inspect: async (_intent, signal) => {
          await checkout.verify(signal);
          return {
            fingerprint: 'observed',
            preview: {
              headOid: null,
              branch: null,
              staged: false,
              trackedChanges: false,
              untrackedCount: 0,
            },
            stashLog: '',
          };
        },
        execute: async () => ({ state: 'completed' }) as never,
      }),
      () => 'preparation',
    );
    await expect(
      operation.execute(
        { projectId: 'project', worktreeId: 'worktree' },
        { action: 'fetch', remoteName: 'origin', sourceRef: 'main' },
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow('identity changed');
    // Fetch, pull, push and stash have no evidence branch, so this is the only
    // check standing between a swapped checkout and a stored preview.
    expect(saved).toEqual([]);
  });

  it('does not hand a capture to the commit generator when the checkout can no longer be confirmed', async () => {
    const statusToken = observation.statusToken;
    // The action inspection verifies and passes, and the change reads confirm
    // through the resolver rather than the session, so the only check left
    // between this capture and the generator is capture's own.
    const { session } = swappedAfterFirstRead(1);
    let generated = 0;
    const operation = new CommitDrafts(
      store(),
      worktrees(),
      (checkout: { verify: (signal?: AbortSignal) => Promise<void> }) => ({
        inspect: async (_intent: unknown, signal?: AbortSignal) => {
          await checkout.verify(signal);
          return {
            fingerprint: 'observed',
            preview: {
              headOid: null,
              branch: null,
              staged: true,
              trackedChanges: true,
              untrackedCount: 0,
            },
            stashLog: '',
          };
        },
        execute: async () => ({ state: 'completed' }) as never,
      }),
      changesReader(),
      new ReadChangeDiffs(
        store(),
        worktrees(),
        inspection(),
        async () => new Map(),
        stamp,
      ),
      {
        list: async () => {
          throw new Error('No untracked file in this fixture');
        },
        read: async () => {
          throw new Error('No untracked file in this fixture');
        },
      },
      {
        models: async () => [],
        generate: async () => {
          generated += 1;
          return [];
        },
      },
    );
    await expect(
      operation.capture(
        { projectId: 'project', worktreeId: 'worktree' },
        {
          expectedStatusToken: statusToken,
          paths: ['file.ts'],
          mode: 'message',
          model: 'fixture',
        },
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow('identity changed');
    // The capture is what leaves the process, so it must never be produced.
    expect(generated).toBe(0);
  });
});
