import { QueryClient } from '@tanstack/query-core';
import { expect, it } from 'vitest';
import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import { queryKeys } from '@porcelain/client/transport';
import { noticeQueryFilters, receiptQueryFilters } from './cache-updates.ts';

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
  const client = new QueryClient();
  const keys = {
    preferences: queryKeys.filePreferences('environment', scope.projectId),
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
  for (const key of Object.values(keys)) client.setQueryData(key, 'cached');
  return {
    client,
    invalidated: () =>
      Object.fromEntries(
        Object.entries(keys).map(([name, key]) => [
          name,
          client.getQueryState(key)?.isInvalidated,
        ]),
      ),
  };
}

it.each([
  {
    change: 'files',
    expected: {
      preferences: false,
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
      preferences: false,
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
      preferences: false,
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
    await Promise.all(
      noticeQueryFilters('environment', notice).map((filters) =>
        subject.client.invalidateQueries(filters),
      ),
    );
    expect(subject.invalidated()).toEqual(expected);
    subject.client.clear();
  },
);

it('a preference notice leaves file contents and inventory untouched', async () => {
  const subject = cache();
  await Promise.all(
    noticeQueryFilters('environment', {
      type: 'project',
      projectId: scope.projectId,
      change: 'preferences',
    }).map((filters) => subject.client.invalidateQueries(filters)),
  );
  expect(subject.invalidated()).toEqual({
    preferences: true,
    changes: false,
    file: false,
    branch: false,
    history: false,
    review: false,
    comments: false,
    foreign: false,
  });
  subject.client.clear();
});

it('a completed push refreshes branch and history without invalidating published review evidence', async () => {
  const subject = cache();
  await Promise.all(
    receiptQueryFilters('environment', { ...receipt, action: 'push' }).map(
      (filters) => subject.client.invalidateQueries(filters),
    ),
  );
  expect(subject.invalidated()).toEqual({
    preferences: false,
    changes: true,
    file: false,
    branch: true,
    history: true,
    review: false,
    comments: false,
    foreign: false,
  });
  subject.client.clear();
});

it.each(['running', 'rejected', 'no-change'] as const)(
  'a $state receipt leaves confirmed data alone',
  async (state) => {
    const subject = cache();
    await Promise.all(
      receiptQueryFilters('environment', { ...receipt, state }).map((filters) =>
        subject.client.invalidateQueries(filters),
      ),
    );
    expect(subject.invalidated()).toEqual({
      preferences: false,
      changes: false,
      file: false,
      branch: false,
      history: false,
      review: false,
      comments: false,
      foreign: false,
    });
    subject.client.clear();
  },
);
