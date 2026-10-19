import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewedLayerStore } from '../../src/ports/reviewed-layer-store.ts';

export type ReviewedLayerStoreSubject = {
  store: ReviewedLayerStore;
  close: () => void | Promise<void>;
};

export function reviewedLayerStoreContract(
  name: string,
  open: (
    reviewIds: readonly string[],
  ) =>
    | { store: ReviewedLayerStore; close: () => void | Promise<void> }
    | Promise<{ store: ReviewedLayerStore; close: () => void | Promise<void> }>,
) {
  describe(name, () => {
    const first = '10000000-0000-4000-8000-000000000001';
    const second = '10000000-0000-4000-8000-000000000002';
    const mark = {
      layerId: 'decision',
      fingerprint: 'first-fingerprint',
      reviewedAt: '2026-10-19T00:00:00.000Z',
    };
    let subject: Awaited<ReturnType<typeof open>>;
    beforeEach(async () => {
      subject = await open([first, second]);
    });
    afterEach(async () => {
      await subject.close();
    });
    it('isolates review owners and retains each decision fingerprint across revisions', async () => {
      await Effect.runPromise(
        subject.store.save({
          reviewId: first,
          marks: [mark, { ...mark, fingerprint: 'second-fingerprint' }],
        }),
      );
      expect(
        await Effect.runPromise(subject.store.list({ reviewId: second })),
      ).toEqual([]);
      expect(
        (await Effect.runPromise(subject.store.list({ reviewId: first })))
          .map((mark) => mark.fingerprint)
          .sort(),
      ).toEqual(['first-fingerprint', 'second-fingerprint']);
      await Effect.runPromise(
        subject.store.save({ reviewId: first, marks: [mark] }),
      );
      expect(
        (await Effect.runPromise(subject.store.list({ reviewId: first })))
          .length,
      ).toBe(2);
    });
    it('unmarks the selected fingerprint without losing another revision or review', async () => {
      await Effect.runPromise(
        subject.store.save({
          reviewId: first,
          marks: [mark, { ...mark, fingerprint: 'second-fingerprint' }],
        }),
      );
      await Effect.runPromise(
        subject.store.save({ reviewId: second, marks: [mark] }),
      );
      await Effect.runPromise(
        subject.store.remove({
          reviewId: first,
          layerId: mark.layerId,
          fingerprint: mark.fingerprint,
        }),
      );
      expect(
        await Effect.runPromise(subject.store.list({ reviewId: first })),
      ).toEqual([{ ...mark, fingerprint: 'second-fingerprint' }]);
      expect(
        await Effect.runPromise(subject.store.list({ reviewId: second })),
      ).toEqual([mark]);
    });
  });
}
