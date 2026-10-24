import { expect, it } from 'vitest';
import { Effect } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import {
  clientFixtures,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import {
  readReview,
  readProjectReviews,
  observeReviewSeen,
} from './project-reviews.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { reviewCommands } from '../commands/project-reviews.ts';
import {
  readReviewComparison,
  readReviewInterdiff,
} from '@porcelain/client/reviews';

const create = clientFixtures();
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

it.each([
  { revision: undefined, path: `/api/reviews/${reviewId}` },
  { revision: 7, path: `/api/reviews/${reviewId}/revisions/7` },
])(
  'preserves an absent review from $path as a successful empty read',
  async ({ revision, path }) => {
    const paths: string[] = [];
    const subject = fixture((sent) => {
      paths.push(sent);
      return Promise.resolve(
        Response.json({ review: null, revisions: [], revision: null }),
      );
    });
    expect(
      await readClientAtom(
        subject.registry,
        readReview({
          connection: subject.connection,
          reviewId,
          ...(revision === undefined ? {} : { revision }),
        }),
      ),
    ).toEqual({ review: undefined, revisions: [], revision: undefined });
    expect(paths).toEqual([path]);
  },
);

it('records seeing a revision once without writing again when inventory reads refresh', async () => {
  const sent: string[] = [];
  const subject = create((path) => {
    sent.push(path);
    return Promise.resolve(
      Response.json(path.endsWith('/seen') ? { updated: true } : []),
    );
  });
  const seen = observeReviewSeen({
    connection: subject.connection,
    reviewId,
    revision: 1,
  });
  const inventory = readProjectReviews({
    connection: subject.connection,
    projectId: 'project',
  });
  const stopSeen = subject.registry.mount(seen);
  const stopInventory = subject.registry.mount(inventory);
  try {
    await readClientAtom(subject.registry, seen);
    await readClientAtom(subject.registry, inventory);
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([queryKeys.inventory('environment')]),
    );
    await expect
      .poll(() => sent.filter((path) => path.endsWith('/reviews')))
      .toHaveLength(2);
    await readClientAtom(subject.registry, seen);
    expect(sent.filter((path) => path.endsWith('/seen'))).toEqual([
      `/api/reviews/${reviewId}/seen`,
    ]);
  } finally {
    stopSeen();
    stopInventory();
  }
});

it('keeps the project list subscribed to its reviews while a list read is pending', async () => {
  const projectId = '20000000-0000-4000-8000-000000000001';
  const started = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<Response>();
  let revision = 1;
  let reads = 0;
  const response = () =>
    Response.json([
      {
        reviewId,
        projectId,
        branch: 'main',
        state: 'open',
        latestRevision: revision,
        lastSeenRevision: 0,
      },
    ]);
  const subject = fixture(() => {
    reads += 1;
    if (reads === 2) {
      started.resolve();
      return pending.promise;
    }
    return Promise.resolve(response());
  });
  const list = readProjectReviews({
    connection: subject.connection,
    projectId,
  });
  const stop = subject.registry.mount(list);
  try {
    expect(
      (await readClientAtom(subject.registry, list))[0]?.latestRevision,
    ).toBe(1);
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([
        queryKeys.projectReviews(subject.connection.environmentId, projectId),
      ]),
    );
    await started.promise;
    const stale = response();
    revision = 2;
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([
        queryKeys.durableReview(subject.connection.environmentId, reviewId),
      ]),
    );
    pending.resolve(stale);
    expect(
      (await readClientAtom(subject.registry, list))[0]?.latestRevision,
    ).toBe(2);
    expect(reads).toBe(3);
  } finally {
    pending.resolve(response());
    stop();
  }
});

it('refreshes an initially loading project list when a review closes before membership is known', async () => {
  const projectId = '20000000-0000-4000-8000-000000000001';
  const pending = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let state: 'open' | 'closed' = 'open';
  let reads = 0;
  const response = () =>
    Response.json([
      {
        reviewId,
        projectId,
        branch: 'main',
        state,
        latestRevision: 1,
        lastSeenRevision: 0,
      },
    ]);
  const subject = fixture((_path, init) => {
    if (init?.method === 'PATCH') {
      state = 'closed';
      return Promise.resolve(Response.json({ updated: true }));
    }
    reads += 1;
    if (reads === 1) {
      started.resolve();
      return pending.promise;
    }
    return Promise.resolve(response());
  });
  const list = readProjectReviews({
    connection: subject.connection,
    projectId,
  });
  const stale = response();
  const stop = subject.registry.mount(list);
  try {
    await started.promise;
    const close = reviewCommands({
      connection: subject.connection,
      reviewId,
    }).close;
    subject.registry.set(close, undefined);
    expect(await readClientAtom(subject.registry, close)).toEqual({
      updated: true,
    });
    pending.resolve(stale);
    expect((await readClientAtom(subject.registry, list))[0]?.state).toBe(
      'closed',
    );
    expect(reads).toBe(2);
  } finally {
    pending.resolve(stale);
    stop();
  }
});
