import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';
import type { ReviewStore } from '../../src/ports/review-store.ts';
import { reviewFixture, reviewSave } from '../fixtures/review.ts';

export type ReviewStoreSubject = {
  store: ReviewStore;
  reviewedLayers: ReviewedLayerStore;
  close: () => Promise<void> | void;
};
export function reviewStoreContract(
  name: string,
  open: (
    worktreeIds: readonly string[],
  ) => ReviewStoreSubject | Promise<ReviewStoreSubject>,
) {
  describe(name, () => {
    let subject: ReviewStoreSubject;
    const first = reviewFixture();
    const key = { reviewId: first.reviewId };
    beforeEach(async () => {
      subject = await open([first.worktreeId]);
    });
    afterEach(async () => {
      await subject.close();
    });
    it('keeps immutable numbered revisions and rejects a stale writer without changing either revision', async () => {
      await Effect.runPromise(subject.store.save(reviewSave(first)));
      const second = {
        ...first,
        revision: 2,
        headOid: 'c'.repeat(40),
        summaryHtml: '<p>Second</p>',
        summaryToken: 'summary-2',
      };
      await Effect.runPromise(subject.store.save(reviewSave(second)));
      expect(await Effect.runPromise(subject.store.read(key))).toEqual(second);
      expect(
        await Effect.runPromise(subject.store.read({ ...key, revision: 1 })),
      ).toEqual(first);
      expect(
        (await Effect.runPromise(subject.store.listRevisions(key))).map(
          (review) => review.revision,
        ),
      ).toEqual([1, 2]);
      expect(
        await Effect.runPromise(
          subject.store
            .save(reviewSave({ ...second, summaryHtml: 'stale' }))
            .pipe(Effect.flip),
        ),
      ).toMatchObject({ _tag: 'ReviewConflictError' });
      expect(await Effect.runPromise(subject.store.read(key))).toEqual(second);
      expect(
        await Effect.runPromise(
          subject.store.findSummary({ token: first.summaryToken }),
        ),
      ).toEqual({
        summaryHtml: first.summaryHtml,
        summaryToken: first.summaryToken,
        summarySecret: first.summarySecret,
      });
    });
    it('retains prior proof when another revision is published and isolates proof by review', async () => {
      const file = {
        id: 'proof-1',
        mediaType: 'image/png' as const,
        bytes: new Uint8Array([1, 2, 3]),
      };
      await Effect.runPromise(
        subject.store.save({ ...reviewSave(first), proofFiles: [file] }),
      );
      await Effect.runPromise(
        subject.store.save(
          reviewSave({ ...first, revision: 2, summaryToken: 'summary-2' }),
        ),
      );
      expect(
        await Effect.runPromise(
          subject.store.readProofFile({ ...key, proofId: file.id }),
        ),
      ).toEqual(file);
      expect(
        await Effect.runPromise(
          subject.store.readProofFile({
            reviewId: 'another',
            proofId: file.id,
          }),
        ),
      ).toBeUndefined();
    });
    it('finds an open branch review for later PR linking and reuses the PR key across branches', async () => {
      await Effect.runPromise(subject.store.save(reviewSave(first)));
      const pullRequest = 'https://github.com/owner/project/pull/42';
      expect(
        (
          await Effect.runPromise(
            subject.store.findOpen({
              projectId: first.projectId,
              branch: first.branch,
              pullRequest,
            }),
          )
        )?.reviewId,
      ).toBe(first.reviewId);
      await Effect.runPromise(
        subject.store.save(
          reviewSave(
            { ...first, revision: 2, summaryToken: 'summary-2' },
            { pullRequest },
          ),
        ),
      );
      expect(
        (
          await Effect.runPromise(
            subject.store.findOpen({
              projectId: first.projectId,
              branch: 'another-branch',
              pullRequest,
            }),
          )
        )?.reviewId,
      ).toBe(first.reviewId);
      expect(
        await Effect.runPromise(
          subject.store.findOpen({
            projectId: first.projectId,
            branch: first.branch,
            pullRequest: 'https://github.com/owner/project/pull/43',
          }),
        ),
      ).toBeUndefined();
      await Effect.runPromise(
        subject.store.setState({ ...key, state: 'closed' }),
      );
      expect(
        await Effect.runPromise(
          subject.store.findOpen({
            projectId: first.projectId,
            branch: first.branch,
            pullRequest,
          }),
        ),
      ).toBeUndefined();
      expect(
        (
          await Effect.runPromise(
            subject.store.list({ projectId: first.projectId }),
          )
        )[0]?.state,
      ).toBe('closed');
    });
    it('keeps last seen monotonic and bounded by the latest published revision', async () => {
      await Effect.runPromise(subject.store.save(reviewSave(first)));
      await Effect.runPromise(
        subject.store.save(
          reviewSave({ ...first, revision: 2, summaryToken: 'summary-2' }),
        ),
      );
      for (const revision of [2, 1, 99])
        await Effect.runPromise(subject.store.markSeen({ ...key, revision }));
      expect(
        (await Effect.runPromise(subject.store.readRecord(key)))
          ?.lastSeenRevision,
      ).toBe(2);
    });
    it('deletes the selected review, revisions, proof and decision marks, and tolerates a repeated delete', async () => {
      await Effect.runPromise(
        subject.store.save({
          ...reviewSave(first),
          proofFiles: [
            {
              id: 'proof-1',
              mediaType: 'image/png',
              bytes: new Uint8Array([1]),
            },
          ],
        }),
      );
      await Effect.runPromise(
        subject.reviewedLayers.save({
          ...key,
          marks: [
            {
              layerId: 'decision',
              fingerprint: 'fingerprint',
              reviewedAt: first.publishedAt,
            },
          ],
        }),
      );
      expect(await Effect.runPromise(subject.store.remove(key))).toBe(true);
      expect(await Effect.runPromise(subject.store.remove(key))).toBe(false);
      expect(
        await Effect.runPromise(subject.store.readRecord(key)),
      ).toBeUndefined();
      expect(await Effect.runPromise(subject.store.listRevisions(key))).toEqual(
        [],
      );
      expect(
        await Effect.runPromise(
          subject.store.readProofFile({ ...key, proofId: 'proof-1' }),
        ),
      ).toBeUndefined();
      expect(await Effect.runPromise(subject.reviewedLayers.list(key))).toEqual(
        [],
      );
    });
  });
}
