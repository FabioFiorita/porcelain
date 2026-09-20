import { RequestGitSession } from '@porcelain/git/git-session';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
import { describe, expect, it } from 'vitest';
import { CommitDrafts } from './commit-drafts.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';
import { PrepareGitAction } from './prepare-git-action.ts';
import { ReadWorktreeEvidence } from './read-worktree-evidence.ts';
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

const worktrees = () =>
  fakeWorktrees([
    {
      id: 'worktree',
      path: '/fixture',
      metadataIdentity: 'metadata',
      main: true,
    },
  ]);

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

function evidenceReader() {
  return new ReadWorktreeEvidence(
    store(),
    worktrees(),
    (checkout: { verify: (signal?: AbortSignal) => Promise<void> }) => ({
      // The real reader verifies before its first read; the fake must too.
      readStatus: async (signal?: AbortSignal) => {
        await checkout.verify(signal);
        return observation;
      },
      readDiff: async () => ({ kind: 'text' as const, patch: '@@' }),
      readDiffs: async () => [{ kind: 'text' as const, patch: '@@' }],
    }),
    { readTextFile: async () => ({ text: '' }) } as never,
    (async () => new Map()) as never,
  );
}

describe('escape-point confirmation', () => {
  it('does not cache a read whose checkout can no longer be confirmed', async () => {
    const { session } = swappedAfterFirstRead();
    const operation = evidenceReader();
    await expect(operation.execute('worktree', session)).rejects.toThrow(
      'identity changed',
    );
    // A second request must still do the work rather than serve a kept answer.
    const fresh = new RequestGitSession(async () => {});
    const result = await operation.execute('worktree', fresh);
    expect(result.evidence).toHaveLength(1);
  });

  it('does not store a mark whose checkout can no longer be confirmed', async () => {
    // The fingerprint a client would have from an earlier read, so the mark
    // reaches the confirmation instead of failing as a stale mark first.
    const observed = (
      await evidenceReader().execute(
        'worktree',
        new RequestGitSession(async () => {}),
      )
    ).evidence[0]?.fingerprint;
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
      evidenceReader(),
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
    // The read and its own caching confirmation both pass, so the only check
    // left between this capture and the generator is capture's own.
    const { session } = swappedAfterFirstRead(2);
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
      evidenceReader(),
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
