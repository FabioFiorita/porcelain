import { Effect } from 'effect';
import { Reactivity } from 'effect/reactivity';
import { expect, it } from 'vitest';
import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import { queryKeys } from '@porcelain/client/transport';
import { noticeReadKeys, receiptReadKeys } from './cache-updates.ts';

const scope = { projectId: 'project', worktreeId: 'tree' };
const receipt: RunGitActionResponse = {
  ...scope,
  requestId: '11111111-1111-4111-8111-111111111111',
  action: 'commit',
  state: 'succeeded',
  acceptedAt: '2026-10-05T10:00:00.000Z',
  progress: [],
};

function cache() {
  const reactivity = Effect.runSync(Reactivity.make);
  const keys = {
    changes: queryKeys.reviewSurface('environment', scope, ['changes']),
    file: queryKeys.reviewSurface('environment', scope, ['text', 'file.ts']),
    branch: queryKeys.reviewSurface('environment', scope, ['branch']),
    history: queryKeys.reviewSurface('environment', scope, [
      'history',
      'commits',
    ]),
    review: queryKeys.reviewSurface('environment', scope, ['review']),
    comments: queryKeys.reviewSurface('environment', scope, ['comments']),
    foreign: queryKeys.reviewSurface('other-environment', scope, ['changes']),
  };
  const flags = Object.fromEntries(
    Object.keys(keys).map((key) => [key, false]),
  );
  const stops = Object.entries(keys).map(([name, key]) =>
    reactivity.registerUnsafe([key.slice(0, 5)], () => {
      flags[name] = true;
    }),
  );
  return {
    reactivity,
    invalidated: () => flags,
    close: () => {
      for (const stop of stops) stop();
    },
  };
}

it.each([
  {
    change: 'files',
    expected: {
      changes: true,
      file: true,
      branch: false,
      history: false,
      review: true,
      comments: false,
      foreign: false,
    },
  },
  {
    change: 'git',
    expected: {
      changes: true,
      file: false,
      branch: true,
      history: true,
      review: true,
      comments: false,
      foreign: false,
    },
  },
  {
    change: 'comments',
    expected: {
      changes: false,
      file: false,
      branch: false,
      history: false,
      review: false,
      comments: true,
      foreign: false,
    },
  },
] satisfies {
  change: Extract<LiveNotice, { type: 'worktree' }>['change'];
  expected: Record<string, boolean>;
}[])(
  'a $change notice refreshes its owned surfaces in the same environment',
  async ({ change, expected }) => {
    const subject = cache();
    const notice: LiveNotice = { type: 'worktree', ...scope, change };
    await Effect.runPromise(
      subject.reactivity.invalidate(noticeReadKeys('environment', notice)),
    );
    expect(subject.invalidated()).toEqual(expected);
    subject.close();
  },
);

it('a preference notice leaves the remaining review caches untouched', async () => {
  const subject = cache();
  await Effect.runPromise(
    subject.reactivity.invalidate(
      noticeReadKeys('environment', {
        type: 'project',
        projectId: scope.projectId,
        change: 'preferences',
      }),
    ),
  );
  expect(subject.invalidated()).toEqual({
    changes: false,
    file: false,
    branch: false,
    history: false,
    review: false,
    comments: false,
    foreign: false,
  });
  subject.close();
});

it('a completed push refreshes branch and history without invalidating published review evidence', async () => {
  const subject = cache();
  await Effect.runPromise(
    subject.reactivity.invalidate(
      receiptReadKeys('environment', { ...receipt, action: 'push' }),
    ),
  );
  expect(subject.invalidated()).toEqual({
    changes: true,
    file: false,
    branch: true,
    history: true,
    review: false,
    comments: false,
    foreign: false,
  });
  subject.close();
});

it.each(['running', 'rejected', 'no-change'] as const)(
  'a $state receipt leaves confirmed data alone',
  async (state) => {
    const subject = cache();
    await Effect.runPromise(
      subject.reactivity.invalidate(
        receiptReadKeys('environment', { ...receipt, state }),
      ),
    );
    expect(subject.invalidated()).toEqual({
      changes: false,
      file: false,
      branch: false,
      history: false,
      review: false,
      comments: false,
      foreign: false,
    });
    subject.close();
  },
);
