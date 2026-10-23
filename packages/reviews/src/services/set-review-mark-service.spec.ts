import { testClock } from '@porcelain/kernel/test-kit';
import { Clock, Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import type { Review } from '../models/review.ts';
import { ReviewCodeReader } from '../ports/review-code-reader.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { ListReviewMarksService } from './list-review-marks-service.ts';
import { RemoveReviewMarkService } from './remove-review-mark-service.ts';
import { SetReviewMarkService } from './set-review-mark-service.ts';

const oldOid = 'c'.repeat(40);
const newOid = 'd'.repeat(40);
const reviewedAt = '2026-10-23T00:00:00.000Z';
const changes: Review['files'] = [
  {
    path: 'removed.ts',
    status: 'deleted',
    oldOid,
    oldMode: '100644',
    newMode: '000000',
  },
  {
    path: 'renamed.ts',
    oldPath: 'original.ts',
    newPath: 'renamed.ts',
    status: 'renamed',
    oldOid,
    newOid,
    oldMode: '100644',
    newMode: '100644',
  },
  {
    path: 'modified.ts',
    status: 'modified',
    oldOid,
    newOid,
    oldMode: '100644',
    newMode: '100644',
  },
  {
    path: 'added.ts',
    status: 'added',
    newOid,
    oldMode: '000000',
    newMode: '100644',
  },
  {
    path: 'type-changed.ts',
    status: 'type-changed',
    oldOid,
    newOid,
    oldMode: '100644',
    newMode: '120000',
  },
  {
    path: 'no-blob.ts',
    status: 'deleted',
    oldMode: '100644',
    newMode: '000000',
  },
];

async function setup(files: Review['files'] = changes) {
  const review = reviewFixture({ files });
  const reviews = new InMemoryReviewStore([review]);
  const fileMarks = new InMemoryReviewedFileStore();
  const layerMarks = new InMemoryReviewedLayerStore();
  const services = Effect.runSync(
    Effect.gen(function* () {
      return {
        set: yield* SetReviewMarkService,
        remove: yield* RemoveReviewMarkService,
        list: yield* ListReviewMarksService,
      };
    }).pipe(
      Effect.provide(SetReviewMarkService.layer),
      Effect.provide(RemoveReviewMarkService.layer),
      Effect.provide(ListReviewMarksService.layer),
      Effect.provideService(ReviewStore, reviews),
      Effect.provideService(ReviewedFileStore, fileMarks),
      Effect.provideService(ReviewedLayerStore, layerMarks),
      Effect.provideService(ReviewCodeReader, {
        readText: ({ path }) => {
          const blobOid =
            path === 'unrelated.ts'
              ? newOid
              : files.find((file) => file.path === path)?.newOid;
          return Effect.succeed(
            blobOid
              ? { kind: 'text' as const, text: 'retained code', blobOid }
              : { kind: 'missing' as const },
          );
        },
      }),
      Effect.provideService(Clock.Clock, await testClock(reviewedAt)),
    ),
  );
  return { ...services, review };
}

describe('SetReviewMarkService', () => {
  it.each(changes.filter((file) => file.path !== 'no-blob.ts'))(
    'marks and unmarks the recorded $status fingerprint',
    async (file) => {
      const { set, remove, list, review } = await setup();
      const headBlobOid = file.newOid ?? oldOid;
      const input = {
        reviewId: review.reviewId,
        kind: 'file' as const,
        revision: 1,
        path: file.path,
        headBlobOid,
      };
      expect(Effect.runSync(set.execute(input))).toEqual({ updated: true });
      expect(Effect.runSync(set.execute(input))).toEqual({ updated: true });
      expect(Effect.runSync(list.execute(input))).toEqual({
        files: [
          {
            path: file.path,
            fingerprint: headBlobOid,
            reviewedAt,
            stale: false,
          },
        ],
        decisions: [],
      });
      expect(Effect.runSync(remove.execute(input))).toEqual({ updated: true });
      expect(Effect.runSync(list.execute(input))).toEqual({
        files: [],
        decisions: [],
      });
    },
  );

  it.each([
    { path: 'removed.ts', headBlobOid: newOid },
    { path: 'renamed.ts', headBlobOid: oldOid },
    { path: 'modified.ts', headBlobOid: oldOid },
    { path: 'added.ts', headBlobOid: oldOid },
    { path: 'type-changed.ts', headBlobOid: oldOid },
    { path: 'unrelated.ts', headBlobOid: newOid },
    { path: 'original.ts', headBlobOid: oldOid },
    { path: 'no-blob.ts', headBlobOid: oldOid },
    { path: '', headBlobOid: '' },
  ])(
    'rejects an unrecorded path or fingerprint: $path $headBlobOid',
    async (input) => {
      const { set, list, review } = await setup();
      expect(
        Effect.runSync(
          set
            .execute({
              reviewId: review.reviewId,
              kind: 'file',
              revision: 1,
              ...input,
            })
            .pipe(Effect.flip),
        ),
      ).toMatchObject({ _tag: 'ReviewedMarkConflictError' });
      expect(Effect.runSync(list.execute(review))).toEqual({
        files: [],
        decisions: [],
      });
    },
  );

  it.each([
    { reviewId: 'unknown', revision: 1 },
    { reviewId: reviewFixture().reviewId, revision: 2 },
  ])(
    'rejects a missing review selection: $reviewId r$revision',
    async (selection) => {
      const { set, list, review } = await setup();
      expect(
        Effect.runSync(
          set
            .execute({
              ...selection,
              kind: 'file',
              path: 'removed.ts',
              headBlobOid: oldOid,
            })
            .pipe(Effect.flip),
        ),
      ).toMatchObject({ _tag: 'ReviewNotFoundError' });
      expect(Effect.runSync(list.execute(review))).toEqual({
        files: [],
        decisions: [],
      });
    },
  );

  it('refuses file marks when the revision has no changes', async () => {
    const { set, list, review } = await setup([]);
    expect(
      Effect.runSync(
        set
          .execute({
            reviewId: review.reviewId,
            revision: 1,
            kind: 'file',
            path: 'unrelated.ts',
            headBlobOid: newOid,
          })
          .pipe(Effect.flip),
      ),
    ).toMatchObject({ _tag: 'ReviewedMarkConflictError' });
    expect(Effect.runSync(list.execute(review))).toEqual({
      files: [],
      decisions: [],
    });
  });
});
