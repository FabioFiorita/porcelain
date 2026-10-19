import { testClock } from '@porcelain/kernel/test-kit';
import { Clock, Effect } from 'effect';
import { expect, it } from 'vitest';
import {
  SignatureSource,
  ResolvePublishedReviewOptions,
} from '../ports/index.ts';
import { ScriptedSignatureSource } from '../../spec/fakes/scripted-signature-source.ts';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { ResolvePublishedReviewService } from './resolve-published-review-service.ts';

it('renders stored decisions and diagnostics at their immutable lines without a worktree or repository', async () => {
  const review = reviewFixture({
    summaryHtml: '<h1>Résumé</h1>',
    notExplained: [{ path: 'removed.ts', ranges: [], deleted: true }],
    layers: [
      {
        id: 'layer',
        title: 'Decision',
        summary: 'Own the behavior',
        lanes: ['Owner'],
        fingerprint: 'published-fingerprint',
        steps: [
          {
            id: 'step',
            lane: 0,
            title: 'Owner',
            text: 'One canonical owner',
            kind: 'changed',
            pointer: { path: 'owner.ts', startLine: 9, endLine: 9 },
            published: ['export const owner = 1;'],
          },
        ],
      },
    ],
  });
  const signatures = new ScriptedSignatureSource();
  const service = Effect.runSync(
    ResolvePublishedReviewService.pipe(
      Effect.provide(ResolvePublishedReviewService.layer),
      Effect.provideService(
        Clock.Clock,
        await testClock('2026-10-19T00:00:00.000Z'),
      ),
      Effect.provideService(SignatureSource, signatures),
      Effect.provideService(ResolvePublishedReviewOptions, {
        lifetimeMs: 3_600_000,
      }),
    ),
  );
  const current = Effect.runSync(
    service.execute({
      review,
      environmentId: 'environment',
      headOid: review.headOid,
    }),
  );
  expect(current.layers[0]?.steps[0]?.location).toEqual({
    state: 'current',
    startLine: 9,
    endLine: 9,
  });
  expect(current.layers[0]?.fingerprint).toBe('published-fingerprint');
  expect(current.notExplained).toEqual([
    { path: 'removed.ts', ranges: [], deleted: true },
  ]);
  expect(current.summary.expires).toBe('2026-10-19T01:00:00.000Z');
  expect(current.summary.byteLength).toBe(17);
  expect(current.verdict).toEqual(review.verdict);
  expect(current.active).toBe(true);
  expect(current.proof.current).toBe(true);
  const advanced = Effect.runSync(
    service.execute({
      review,
      environmentId: 'environment',
      headOid: 'c'.repeat(40),
    }),
  );
  expect(advanced.active).toBe(false);
  expect(advanced.proof.current).toBe(false);
  expect(advanced.layers).toEqual(current.layers);
});
