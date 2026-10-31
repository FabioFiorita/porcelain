import { expect, it } from 'vitest';
import { AsyncResult, Reactivity } from 'effect/reactivity';
import {
  clientFixtures,
  readClientAtom,
} from '../../../../spec/kit/client-fixture.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { readReviewComments } from './project-reviews.ts';
import { readCommentThreads } from './comments.ts';

const create = clientFixtures('00000000-0000-4000-8000-000000000001');
const reviewId = '10000000-0000-4000-8000-000000000001';
const scope = { projectId: 'project', worktreeId: 'a'.repeat(32) };
const thread = {
  id: '20000000-0000-4000-8000-000000000001',
  worktreeId: scope.worktreeId,
  anchor: { kind: 'change' },
  resolved: false,
  revision: 1,
  messages: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      author: 'reviewer',
      body: 'Keep this published discussion readable.',
    },
  ],
};
const retained = {
  ...thread,
  review: { reviewId, revision: 1, headOid: 'b'.repeat(40) },
};
const local = { ...thread, id: '20000000-0000-4000-8000-000000000002' };

function fixture(
  worktree: () => Response,
  discussion = () => Response.json([retained]),
) {
  const subject = create((path) =>
    Promise.resolve(
      path === `/api/worktrees/${scope.worktreeId}/comments`
        ? worktree()
        : path === `/api/reviews/${reviewId}/comments`
          ? discussion()
          : Response.json({ review: null, revisions: [], revision: null }),
    ),
  );
  return {
    ...subject,
    atom: readReviewComments({
      connection: subject.connection,
      reviewId,
      worktree: scope,
    }),
  };
}

function failure(statusCode: number, error: string, message: string) {
  return Response.json({ statusCode, error, message }, { status: statusCode });
}

it.each([
  [422, 'Unprocessable Entity', 'Repository could not be inspected'],
  [404, 'Not Found', 'Worktree not found'],
  [404, 'Not Found', 'Project not found'],
] as const)(
  'keeps the retained discussion when the optional checkout answers %s: %s / %s',
  async (status, error, message) => {
    const subject = fixture(() => failure(status, error, message));
    expect(await readClientAtom(subject.registry, subject.atom)).toEqual([
      retained,
    ]);
  },
);

it.each([403, 500])(
  'preserves an unrelated optional-discussion failure with HTTP %s',
  async (status) => {
    const subject = fixture(() =>
      failure(
        status,
        status === 403 ? 'Forbidden' : 'Internal Server Error',
        'Discussion failed',
      ),
    );
    await expect(
      readClientAtom(subject.registry, subject.atom),
    ).rejects.toMatchObject({ status });
  },
);

it('does not replace a failed retained discussion with checkout comments', async () => {
  const subject = fixture(
    () => Response.json([local]),
    () =>
      failure(422, 'Unprocessable Entity', 'Repository could not be inspected'),
  );
  await expect(
    readClientAtom(subject.registry, subject.atom),
  ).rejects.toMatchObject({ _tag: 'WorktreeUnavailableError' });
});

it('adds current checkout comments when its unavailable context recovers', async () => {
  let available = false;
  const subject = fixture(() =>
    available
      ? Response.json([retained, local])
      : failure(
          422,
          'Unprocessable Entity',
          'Repository could not be inspected',
        ),
  );
  const stop = subject.registry.mount(subject.atom);
  try {
    expect(await readClientAtom(subject.registry, subject.atom)).toEqual([
      retained,
    ]);
    available = true;
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([
        queryKeys.reviewSurface(subject.connection.environmentId, scope, [
          'comments',
        ]),
      ]),
    );
    await expect
      .poll(() => readClientAtom(subject.registry, subject.atom))
      .toEqual([retained, local]);
  } finally {
    stop();
  }
});

it('keeps confirmed checkout comments when that checkout becomes unavailable', async () => {
  let available = true;
  const subject = fixture(() =>
    available
      ? Response.json([local])
      : failure(
          422,
          'Unprocessable Entity',
          'Repository could not be inspected',
        ),
  );
  const checkout = readCommentThreads({
    connection: subject.connection,
    scope,
  });
  const stop = subject.registry.mount(subject.atom);
  try {
    expect(await readClientAtom(subject.registry, subject.atom)).toEqual([
      retained,
      local,
    ]);
    available = false;
    await subject.connection.runtime.runPromise(
      Reactivity.invalidate([
        queryKeys.reviewSurface(subject.connection.environmentId, scope, [
          'comments',
        ]),
      ]),
    );
    await expect
      .poll(() => AsyncResult.isFailure(subject.registry.get(checkout)))
      .toBe(true);
    expect(await readClientAtom(subject.registry, subject.atom)).toEqual([
      retained,
      local,
    ]);
  } finally {
    stop();
  }
});
