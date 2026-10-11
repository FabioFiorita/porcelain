import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiagramBox, Review } from '../../src/models/review.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';

export type ReviewStoreSubject = {
  store: ReviewStore;
  close: () => Promise<void> | void;
};

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const third = 'c'.repeat(64);

function review(worktreeId: string, revision = 1): Review {
  return {
    worktreeId,
    revision,
    publishedAt: '2026-09-24T10:00:00.000Z',
    active: true,
    summaryHtml: `<p>Summary ${revision}</p>`,
    summaryToken: `token-${worktreeId.slice(0, 1)}-${revision}`,
    summarySecret: `secret-${revision}`,
    layers: [
      {
        id: 'layer',
        title: 'Layer',
        summary: 'What changed',
        lanes: ['Server'],
        steps: [
          {
            id: 'step',
            lane: 0,
            title: 'Step',
            text: 'Text',
            kind: 'changed',
            pointer: { path: 'src/index.ts', startLine: 1, endLine: 2 },
            published: ['published'],
          },
        ],
        fingerprint: 'fingerprint',
      },
    ],
  };
}

function byWorktree(reviews: readonly Review[]): Review[] {
  return reviews.toSorted((left, right) =>
    left.worktreeId.localeCompare(right.worktreeId),
  );
}

export function reviewStoreContract(
  subject: string,
  openSubject: (
    worktreeIds: readonly string[],
  ) => ReviewStoreSubject | Promise<ReviewStoreSubject>,
): void {
  describe(subject, () => {
    let opened: ReviewStoreSubject;
    let store: ReviewStore;

    beforeEach(async () => {
      opened = await openSubject([first, second, third]);
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('reads nothing for a worktree without a published review', async () => {
      await Effect.runPromise(store.save(review(second)));
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toBeUndefined();
    });

    it('reads a saved review back as it was saved', async () => {
      await Effect.runPromise(store.save(review(first)));
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toEqual(review(first));
    });

    it('reads a saved diagram back with its decision marker', async () => {
      const box: DiagramBox = {
        id: 'box',
        label: 'Server',
        decision: true,
        layerId: 'layer',
      };
      const withDiagram = {
        ...review(first),
        diagram: {
          after: { boxes: [box], arrows: [] },
        },
      };
      await Effect.runPromise(store.save(withDiagram));
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toEqual(withDiagram);
    });

    it('reads saved proof back with the review and its files by worktree and id', async () => {
      const proof = {
        checks: [
          { name: 'Tests', result: 'fail' as const, output: 'one failed' },
        ],
        assets: [
          {
            id: 'shot',
            kind: 'image' as const,
            title: 'Screenshot',
            mediaType: 'image/png' as const,
            byteLength: 3,
            layerId: 'layer',
          },
        ],
      };
      const bytes = new Uint8Array([0x89, 0x50, 0x4e]);
      await Effect.runPromise(
        store.save({
          ...review(first),
          proof,
          proofFiles: [{ id: 'shot', mediaType: 'image/png', bytes }],
        }),
      );
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toEqual({
        ...review(first),
        proof,
      });
      expect(
        await Effect.runPromise(
          store.readProofFile({ worktreeId: first, proofId: 'shot' }),
        ),
      ).toEqual({ id: 'shot', mediaType: 'image/png', bytes });
      expect(
        await Effect.runPromise(
          store.readProofFile({ worktreeId: second, proofId: 'shot' }),
        ),
      ).toBeUndefined();
    });

    it('replaces the proof files of a worktree when its next review is saved', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      await Effect.runPromise(
        store.save({
          ...review(first, 1),
          proofFiles: [{ id: 'old', mediaType: 'image/png', bytes }],
        }),
      );
      await Effect.runPromise(
        store.save({
          ...review(second),
          proofFiles: [{ id: 'kept', mediaType: 'image/png', bytes }],
        }),
      );
      await Effect.runPromise(
        store.save({
          ...review(first, 2),
          proofFiles: [{ id: 'new', mediaType: 'video/webm', bytes }],
        }),
      );
      expect(
        await Effect.runPromise(
          store.readProofFile({ worktreeId: first, proofId: 'old' }),
        ),
      ).toBeUndefined();
      expect(
        await Effect.runPromise(
          store.readProofFile({ worktreeId: first, proofId: 'new' }),
        ),
      ).toEqual({ id: 'new', mediaType: 'video/webm', bytes });
      expect(
        await Effect.runPromise(
          store.readProofFile({ worktreeId: second, proofId: 'kept' }),
        ),
      ).toEqual({ id: 'kept', mediaType: 'image/png', bytes });
      await Effect.runPromise(store.save(review(first, 3)));
      expect(
        await Effect.runPromise(
          store.readProofFile({ worktreeId: first, proofId: 'new' }),
        ),
      ).toBeUndefined();
    });

    it('replaces the review of a worktree when a newer one is saved', async () => {
      await Effect.runPromise(store.save(review(first, 1)));
      await Effect.runPromise(store.save(review(first, 2)));
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toEqual(review(first, 2));
      expect(
        await Effect.runPromise(store.byWorktrees({ worktreeIds: [first] })),
      ).toEqual([review(first, 2)]);
    });

    it('reads the reviews of the asked worktrees only', async () => {
      await Effect.runPromise(store.save(review(first)));
      await Effect.runPromise(store.save(review(second)));
      await Effect.runPromise(store.save(review(third)));
      expect(
        byWorktree(
          await Effect.runPromise(
            store.byWorktrees({ worktreeIds: [third, first] }),
          ),
        ),
      ).toEqual([review(first), review(third)]);
    });

    it('reads no reviews when no worktree is asked', async () => {
      await Effect.runPromise(store.save(review(first)));
      expect(
        await Effect.runPromise(store.byWorktrees({ worktreeIds: [] })),
      ).toEqual([]);
    });

    it('finds the summary of a review by its token', async () => {
      await Effect.runPromise(store.save(review(first)));
      await Effect.runPromise(store.save(review(second)));
      expect(
        await Effect.runPromise(
          store.findSummary({ token: review(second).summaryToken }),
        ),
      ).toEqual({
        summaryHtml: review(second).summaryHtml,
        summaryToken: review(second).summaryToken,
        summarySecret: review(second).summarySecret,
      });
    });

    it('finds no summary for an unknown token or a replaced review', async () => {
      await Effect.runPromise(store.save(review(first, 1)));
      await Effect.runPromise(store.save(review(first, 2)));
      expect(
        await Effect.runPromise(store.findSummary({ token: 'unknown' })),
      ).toBeUndefined();
      expect(
        await Effect.runPromise(
          store.findSummary({ token: review(first, 1).summaryToken }),
        ),
      ).toBeUndefined();
    });

    it('deactivates and reactivates the review at the asked revision', async () => {
      await Effect.runPromise(store.save(review(first, 2)));
      await Effect.runPromise(
        store.setActive({ worktreeId: first, revision: 2, active: false }),
      );
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toEqual({
        ...review(first, 2),
        active: false,
      });
      await Effect.runPromise(
        store.setActive({ worktreeId: first, revision: 2, active: true }),
      );
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toEqual(review(first, 2));
    });

    it('leaves the review active when another revision is deactivated', async () => {
      await Effect.runPromise(store.save(review(first, 2)));
      await Effect.runPromise(
        store.setActive({ worktreeId: first, revision: 1, active: false }),
      );
      expect(
        await Effect.runPromise(store.read({ worktreeId: first })),
      ).toEqual(review(first, 2));
    });

    it('leaves other worktrees active when one review is deactivated', async () => {
      await Effect.runPromise(store.save(review(first)));
      await Effect.runPromise(store.save(review(second)));
      await Effect.runPromise(
        store.setActive({ worktreeId: first, revision: 1, active: false }),
      );
      expect(
        await Effect.runPromise(store.read({ worktreeId: second })),
      ).toEqual(review(second));
    });

    it.each(['read', 'bulk read'])(
      'hands out a copy of the %s review, so changing it leaves the stored one unchanged',
      async (source) => {
        const saved = review(first);
        await Effect.runPromise(store.save(saved));
        saved.summaryHtml = '<p>Changed after saving</p>';
        const returned =
          source === 'read'
            ? await Effect.runPromise(store.read({ worktreeId: first }))
            : (
                await Effect.runPromise(
                  store.byWorktrees({ worktreeIds: [first] }),
                )
              ).at(0);
        expect(returned).toBeDefined();
        if (!returned) throw new Error('The saved review must be available');
        Array.prototype.pop.call(returned.layers);
        expect(
          await Effect.runPromise(store.read({ worktreeId: first })),
        ).toEqual(review(first));
      },
    );
  });
}
