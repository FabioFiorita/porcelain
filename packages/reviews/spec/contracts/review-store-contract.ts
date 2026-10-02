import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiagramBox, Review } from '../../src/models/review.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';

export type ReviewStoreSubject = {
  store: ReviewStore;
  close: () => void;
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
  openSubject: (worktreeIds: readonly string[]) => ReviewStoreSubject,
): void {
  describe(subject, () => {
    let opened: ReviewStoreSubject;
    let store: ReviewStore;

    beforeEach(() => {
      opened = openSubject([first, second, third]);
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('reads nothing for a worktree without a published review', () => {
      store.save(review(second));
      expect(store.read({ worktreeId: first })).toBeUndefined();
      expect(store.read({ worktreeId: second })).toEqual(review(second));
    });

    it('reads a saved review back as it was saved', () => {
      store.save(review(first));
      expect(store.read({ worktreeId: first })).toEqual(review(first));
    });

    it('reads a saved diagram back with its before and after', () => {
      const box: DiagramBox = {
        id: 'box',
        lane: 0,
        label: 'Server',
        kind: 'component',
      };
      const withDiagram = {
        ...review(first),
        diagram: {
          after: { lanes: ['Server'], boxes: [box], arrows: [] },
          before: { lanes: ['Server'], boxes: [], arrows: [] },
        },
      };
      store.save(withDiagram);
      expect(store.read({ worktreeId: first })).toEqual(withDiagram);
    });

    it('reads saved proof back with the review and its files by worktree and id', () => {
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
      store.save({
        ...review(first),
        proof,
        proofFiles: [{ id: 'shot', mediaType: 'image/png', bytes }],
      });
      expect(store.read({ worktreeId: first })).toEqual({
        ...review(first),
        proof,
      });
      expect(
        store.readProofFile({ worktreeId: first, proofId: 'shot' }),
      ).toEqual({ id: 'shot', mediaType: 'image/png', bytes });
      expect(
        store.readProofFile({ worktreeId: second, proofId: 'shot' }),
      ).toBeUndefined();
    });

    it('replaces the proof files of a worktree when its next review is saved', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      store.save({
        ...review(first, 1),
        proofFiles: [{ id: 'old', mediaType: 'image/png', bytes }],
      });
      store.save({
        ...review(second),
        proofFiles: [{ id: 'kept', mediaType: 'image/png', bytes }],
      });
      store.save({
        ...review(first, 2),
        proofFiles: [{ id: 'new', mediaType: 'video/webm', bytes }],
      });
      expect(
        store.readProofFile({ worktreeId: first, proofId: 'old' }),
      ).toBeUndefined();
      expect(
        store.readProofFile({ worktreeId: first, proofId: 'new' }),
      ).toEqual({ id: 'new', mediaType: 'video/webm', bytes });
      expect(
        store.readProofFile({ worktreeId: second, proofId: 'kept' }),
      ).toEqual({ id: 'kept', mediaType: 'image/png', bytes });
      store.save(review(first, 3));
      expect(
        store.readProofFile({ worktreeId: first, proofId: 'new' }),
      ).toBeUndefined();
    });

    it('replaces the review of a worktree when a newer one is saved', () => {
      store.save(review(first, 1));
      store.save(review(first, 2));
      expect(store.read({ worktreeId: first })).toEqual(review(first, 2));
      expect(store.byWorktrees({ worktreeIds: [first] })).toEqual([
        review(first, 2),
      ]);
    });

    it('reads the reviews of the asked worktrees only', () => {
      store.save(review(first));
      store.save(review(second));
      store.save(review(third));
      expect(
        byWorktree(store.byWorktrees({ worktreeIds: [third, first] })),
      ).toEqual([review(first), review(third)]);
    });

    it('reads no reviews when no worktree is asked, and the saved one when its worktree is', () => {
      store.save(review(first));
      expect(store.byWorktrees({ worktreeIds: [] })).toEqual([]);
      expect(store.byWorktrees({ worktreeIds: [first] })).toEqual([
        review(first),
      ]);
    });

    it('finds the summary of a review by its token', () => {
      store.save(review(first));
      store.save(review(second));
      expect(store.findSummary({ token: review(second).summaryToken })).toEqual(
        {
          summaryHtml: review(second).summaryHtml,
          summaryToken: review(second).summaryToken,
          summarySecret: review(second).summarySecret,
        },
      );
    });

    it('finds no summary for an unknown token or a replaced review, only for the review that replaced it', () => {
      store.save(review(first, 1));
      store.save(review(first, 2));
      expect(store.findSummary({ token: 'unknown' })).toBeUndefined();
      expect(
        store.findSummary({ token: review(first, 1).summaryToken }),
      ).toBeUndefined();
      expect(store.findSummary({ token: 'token-a-2' })).toEqual({
        summaryHtml: '<p>Summary 2</p>',
        summaryToken: 'token-a-2',
        summarySecret: 'secret-2',
      });
    });

    it('deactivates and reactivates the review at the asked revision', () => {
      store.save(review(first, 2));
      store.setActive({ worktreeId: first, revision: 2, active: false });
      expect(store.read({ worktreeId: first })).toEqual({
        ...review(first, 2),
        active: false,
      });
      store.setActive({ worktreeId: first, revision: 2, active: true });
      expect(store.read({ worktreeId: first })).toEqual(review(first, 2));
    });

    it('leaves the review active when another revision is deactivated', () => {
      store.save(review(first, 2));
      store.setActive({ worktreeId: first, revision: 1, active: false });
      expect(store.read({ worktreeId: first })).toEqual(review(first, 2));
    });

    it('leaves other worktrees active when one review is deactivated', () => {
      store.save(review(first));
      store.save(review(second));
      store.setActive({ worktreeId: first, revision: 1, active: false });
      expect(store.read({ worktreeId: second })).toEqual(review(second));
    });

    it('hands out copies, so changing a returned review leaves the stored one unchanged', () => {
      const saved = review(first);
      store.save(saved);
      saved.summaryHtml = '<p>Changed after saving</p>';
      store.read({ worktreeId: first })?.layers.pop();
      store
        .byWorktrees({ worktreeIds: [first] })
        .at(0)
        ?.layers.pop();
      expect(store.read({ worktreeId: first })).toEqual(review(first));
    });
  });
}
