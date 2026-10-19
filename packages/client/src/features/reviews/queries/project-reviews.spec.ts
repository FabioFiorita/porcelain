import { expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import {
  readReviewComparison,
  readReviewInterdiff,
} from '@porcelain/client/reviews';

const reviewId = '10000000-0000-4000-8000-000000000001';
const answer = {
  reviewId,
  from: null,
  to: 2,
  comparison: null,
  unknown: [{ area: 'baseline', reason: 'No last seen revision', ids: [] }],
};
const fixture = clientFixtures('00000000-0000-4000-8000-000000000001');
it('leaves defaults to the server and reads an explicit selection through the selected connection', async () => {
  const paths: string[] = [];
  const subject = fixture((path) => {
    paths.push(path);
    return Promise.resolve(
      Response.json(path.includes('from=') ? { ...answer, from: 1 } : answer),
    );
  });
  const input = { connection: subject.connection, reviewId };
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(subject.registry, readReviewComparison(input)),
    ),
  ).toEqual({ ...answer, from: undefined, comparison: undefined });
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readReviewComparison({ ...input, from: 1, to: 2 }),
      ),
    ),
  ).toMatchObject({ from: 1, to: 2 });
  expect(paths).toEqual([
    `/api/reviews/${reviewId}/compare`,
    `/api/reviews/${reviewId}/compare?from=1&to=2`,
  ]);
});
it.each([
  [
    'review',
    { ...answer, reviewId: '20000000-0000-4000-8000-000000000001', from: 1 },
  ],
  ['revision', { ...answer, from: 2 }],
])('refuses a comparison answered for another %s', async (_name, changed) => {
  const subject = fixture(() => Promise.resolve(Response.json(changed)));
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readReviewComparison({
          connection: subject.connection,
          reviewId,
          from: 1,
          to: 2,
        }),
      ),
    ),
  ).rejects.toMatchObject({
    _tag: 'ConnectionError',
    message:
      'The connected context changed. Reopen Porcelain to continue safely.',
  });
});
it('reads a bounded file interdiff with an encoded literal path and preserves omission reasons', async () => {
  const paths: string[] = [];
  const diff = {
    kind: 'diff',
    from: 1,
    to: 2,
    path: 'a b.ts',
    diffs: [
      { paths: ['a b.ts'], content: { kind: 'omitted', reason: 'size-limit' } },
    ],
  };
  const subject = fixture((path) => {
    paths.push(path);
    return Promise.resolve(Response.json(diff));
  });
  expect(
    await Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readReviewInterdiff({
          connection: subject.connection,
          reviewId,
          from: 1,
          to: 2,
          path: 'a b.ts',
        }),
      ),
    ),
  ).toEqual(diff);
  expect(paths).toEqual([
    `/api/reviews/${reviewId}/interdiff?from=1&to=2&path=a+b.ts`,
  ]);
});
it.each([
  ['file', { path: 'other.ts', from: 1 }],
  ['revision', { path: 'file.ts', from: 2 }],
])('refuses a file interdiff for a different %s', async (_name, changed) => {
  const subject = fixture(() =>
    Promise.resolve(
      Response.json({
        kind: 'diff',
        ...changed,
        to: 2,
        diffs: [
          { paths: ['file.ts'], content: { kind: 'text', patch: '+wrong' } },
        ],
      }),
    ),
  );
  await expect(
    Effect.runPromise(
      AtomRegistry.getResult(
        subject.registry,
        readReviewInterdiff({
          connection: subject.connection,
          reviewId,
          from: 1,
          to: 2,
          path: 'file.ts',
        }),
      ),
    ),
  ).rejects.toMatchObject({
    _tag: 'ConnectionError',
    message:
      'The connected context changed. Reopen Porcelain to continue safely.',
  });
});
