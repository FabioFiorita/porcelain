import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitActionReceipt } from '../../src/models/git-action-receipt.ts';
import type { GitActionReceiptStore } from '../../src/ports/git-action-receipt-store.ts';

export type GitActionReceiptStoreSubject = {
  store: GitActionReceiptStore;
  close: () => Promise<void> | void;
};

export type GitActionReceiptScope = {
  projectId: string;
  worktreeIds: readonly string[];
};

const projectId = 'project';
const worktreeId = 'worktree';
const otherWorktreeId = 'other-worktree';

function running(
  requestId: string,
  overrides: Partial<GitActionReceipt> = {},
): GitActionReceipt {
  return {
    requestId,
    projectId,
    worktreeId,
    action: 'fetch',
    intent: { action: 'fetch', remoteName: 'origin', sourceRef: 'main' },
    expected: { upstream: {} },
    state: 'running',
    progress: [],
    refreshRequired: false,
    acceptedAt: '2026-09-23T09:00:00.000Z',
    ...overrides,
  };
}

function interrupted(
  requestId: string,
  finishedAt: string,
  overrides: Partial<GitActionReceipt> = {},
): GitActionReceipt {
  return running(requestId, {
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
    refreshRequired: true,
    finishedAt,
    ...overrides,
  });
}

const committed = running('committed', {
  action: 'commit',
  intent: { action: 'commit', message: 'Ship it', paths: ['src/index.ts'] },
  expected: {
    headOid: 'a'.repeat(40),
    branch: 'main',
    files: [{ path: 'src/index.ts', fingerprint: 'fingerprint' }],
  },
  state: 'succeeded',
  message: 'Committed',
  result: { headOid: 'b'.repeat(40), branch: 'main' },
  progress: ['Writing objects'],
  refreshRequired: true,
  finishedAt: '2026-09-23T09:00:05.000Z',
  dismissedAt: '2026-09-23T09:10:00.000Z',
});

export function gitActionReceiptStoreContract(
  subject: string,
  openSubject: (
    scope: GitActionReceiptScope,
  ) => GitActionReceiptStoreSubject | Promise<GitActionReceiptStoreSubject>,
): void {
  describe(subject, () => {
    let opened: GitActionReceiptStoreSubject;
    let store: GitActionReceiptStore;

    beforeEach(async () => {
      opened = await openSubject({
        projectId,
        worktreeIds: [worktreeId, otherWorktreeId],
      });
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('reads nothing for an unknown request', async () => {
      await Effect.runPromise(store.insert(running('known')));
      expect(
        await Effect.runPromise(store.read({ requestId: 'unknown' })),
      ).toBeUndefined();
    });

    it('reads an inserted receipt back with everything it holds', async () => {
      await Effect.runPromise(store.insert(committed));
      expect(
        await Effect.runPromise(store.read({ requestId: 'committed' })),
      ).toEqual(committed);
    });

    it('reads a receipt back as it was last saved', async () => {
      await Effect.runPromise(store.insert(running('fetch')));
      const settled = running('fetch', {
        state: 'no-change',
        progress: ['Receiving objects'],
        result: { trackingOid: 'c'.repeat(40) },
        finishedAt: '2026-09-23T09:00:05.000Z',
      });
      await Effect.runPromise(store.save(settled));
      expect(
        await Effect.runPromise(store.read({ requestId: 'fetch' })),
      ).toEqual(settled);
    });

    it('stores nothing when a receipt that was never inserted is saved', async () => {
      await Effect.runPromise(store.save(running('never-inserted')));
      expect(
        await Effect.runPromise(store.read({ requestId: 'never-inserted' })),
      ).toBeUndefined();
      expect(await Effect.runPromise(store.running())).toEqual([]);
    });

    it('lists the running receipts of every worktree and nothing that finished', async () => {
      await Effect.runPromise(store.insert(running('first')));
      await Effect.runPromise(
        store.insert(running('second', { worktreeId: otherWorktreeId })),
      );
      await Effect.runPromise(store.insert(committed));
      expect(
        (await Effect.runPromise(store.running()))
          .map((receipt) => receipt.requestId)
          .toSorted(),
      ).toEqual(['first', 'second']);
    });

    it('stops listing a receipt as running once it is saved finished', async () => {
      await Effect.runPromise(store.insert(running('fetch')));
      await Effect.runPromise(
        store.save(interrupted('fetch', '2026-09-23T09:00:05.000Z')),
      );
      expect(await Effect.runPromise(store.running())).toEqual([]);
    });

    it('finds the latest undismissed interrupted receipt of a worktree by when it finished', async () => {
      await Effect.runPromise(
        store.insert(interrupted('early', '2026-09-23T09:59:59.999Z')),
      );
      await Effect.runPromise(
        store.insert(interrupted('latest', '2026-09-23T10:00:00.000Z')),
      );
      await Effect.runPromise(
        store.insert(
          interrupted('dismissed', '2026-09-23T11:00:00.000Z', {
            dismissedAt: '2026-09-23T11:30:00.000Z',
          }),
        ),
      );
      await Effect.runPromise(
        store.insert(
          interrupted('elsewhere', '2026-09-23T12:00:00.000Z', {
            worktreeId: otherWorktreeId,
          }),
        ),
      );
      await Effect.runPromise(
        store.insert(
          running('rejected', {
            state: 'rejected',
            finishedAt: '2026-09-23T13:00:00.000Z',
          }),
        ),
      );
      expect(
        (await Effect.runPromise(store.latestInterrupted({ worktreeId })))
          ?.requestId,
      ).toBe('latest');
    });

    it('finds no interrupted receipt once the last one is dismissed', async () => {
      const receipt = interrupted('only', '2026-09-23T10:00:00.000Z');
      await Effect.runPromise(store.insert(receipt));
      await Effect.runPromise(
        store.save({ ...receipt, dismissedAt: '2026-09-23T10:30:00.000Z' }),
      );
      expect(
        await Effect.runPromise(store.latestInterrupted({ worktreeId })),
      ).toBeUndefined();
    });

    it('finds no interrupted receipt for a worktree without any', async () => {
      await Effect.runPromise(
        store.insert(interrupted('elsewhere', '2026-09-23T10:00:00.000Z')),
      );
      expect(
        await Effect.runPromise(
          store.latestInterrupted({ worktreeId: otherWorktreeId }),
        ),
      ).toBeUndefined();
    });

    it('lists every finished receipt with when it finished, and none still running', async () => {
      await Effect.runPromise(store.insert(running('running')));
      await Effect.runPromise(
        store.insert(interrupted('old', '2026-08-01T00:00:00.000Z')),
      );
      await Effect.runPromise(store.insert(committed));
      expect(
        (await Effect.runPromise(store.finished())).toSorted((left, right) =>
          left.requestId.localeCompare(right.requestId),
        ),
      ).toEqual([
        { requestId: 'committed', finishedAt: '2026-09-23T09:00:05.000Z' },
        { requestId: 'old', finishedAt: '2026-08-01T00:00:00.000Z' },
      ]);
    });

    it('removes the asked receipts and keeps the others', async () => {
      await Effect.runPromise(store.insert(running('running')));
      await Effect.runPromise(
        store.insert(interrupted('old', '2026-08-01T00:00:00.000Z')),
      );
      await Effect.runPromise(
        store.insert(interrupted('recent', '2026-09-23T10:00:00.000Z')),
      );
      await Effect.runPromise(store.remove({ requestIds: ['old', 'unknown'] }));
      await Effect.runPromise(store.remove({ requestIds: [] }));
      expect(
        await Effect.runPromise(store.read({ requestId: 'old' })),
      ).toBeUndefined();
      expect(
        await Effect.runPromise(store.read({ requestId: 'recent' })),
      ).toEqual(interrupted('recent', '2026-09-23T10:00:00.000Z'));
      expect(
        (await Effect.runPromise(store.running())).map(
          (receipt) => receipt.requestId,
        ),
      ).toEqual(['running']);
    });

    it('hands out copies, so changing a returned receipt leaves the stored one unchanged', async () => {
      const inserted = running('fetch');
      await Effect.runPromise(store.insert(inserted));
      inserted.progress.push('Changed after inserting');
      (
        await Effect.runPromise(store.read({ requestId: 'fetch' }))
      )?.progress.push('Changed after reading');
      (await Effect.runPromise(store.running()))
        .at(0)
        ?.progress.push('Changed after listing');
      expect(
        await Effect.runPromise(store.read({ requestId: 'fetch' })),
      ).toEqual(running('fetch'));
    });
  });
}
