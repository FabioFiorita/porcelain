import { expect, it } from 'vitest';
import { Reactivity } from 'effect/reactivity';
import {
  clientFixtures,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { reviewCommands } from '../commands/project-reviews.ts';
import { readReviewPullChecks } from './project-reviews.ts';
const create = clientFixtures();
const firstId = '10000000-0000-4000-8000-000000000001';
const secondId = '20000000-0000-4000-8000-000000000001';
it('ignores global inventory changes, scopes a decision mark to its own PR and retains explicit and connection refresh', async () => {
  const reads: string[] = [];
  const subject = create((path) => {
    if (path.endsWith('/marks'))
      return Promise.resolve(Response.json({ updated: true }));
    reads.push(path);
    return Promise.resolve(
      Response.json({
        kind: 'available',
        number: path.includes(firstId) ? 42 : 43,
        checks: 'passed',
      }),
    );
  });
  const first = readReviewPullChecks({
    connection: subject.connection,
    reviewId: firstId,
  });
  const second = readReviewPullChecks({
    connection: subject.connection,
    reviewId: secondId,
  });
  const stopFirst = subject.registry.mount(first);
  const stopSecond = subject.registry.mount(second);
  const counts = () =>
    [firstId, secondId].map(
      (id) =>
        reads.filter(
          (path) => path === `/api/reviews/${id}/pull-request/checks`,
        ).length,
    );
  const settled = async () => {
    await readClientAtom(subject.registry, first);
    await readClientAtom(subject.registry, second);
  };
  try {
    await settled();
    expect(counts()).toEqual([1, 1]);
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([queryKeys.inventory('environment')]),
    );
    await settled();
    expect(counts()).toEqual([1, 1]);
    const mark = reviewCommands({
      connection: subject.connection,
      reviewId: firstId,
    }).mark;
    subject.registry.set(mark, {
      kind: 'decision',
      revision: 1,
      layerId: '30000000-0000-4000-8000-000000000001',
      fingerprint: 'a'.repeat(64),
    });
    await readClientAtom(subject.registry, mark);
    await settled();
    expect(counts()).toEqual([2, 1]);
    subject.registry.refresh(second);
    await settled();
    expect(counts()).toEqual([2, 2]);
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([queryKeys.durableReview('environment', firstId)]),
    );
    await settled();
    expect(counts()).toEqual([3, 2]);
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([queryKeys.environment('environment')]),
    );
    await settled();
    expect(counts()).toEqual([4, 3]);
  } finally {
    stopFirst();
    stopSecond();
  }
});
