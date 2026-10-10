import { Schema } from 'effect';
import { worktreeLabel } from '@porcelain/client/projects/rules';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  listCommentThreadsResponseSchema,
  listReviewedFilesResponseSchema,
} from '@porcelain/contracts/reviews';
import { expect, test } from './fixtures.ts';

test('reviewing a changed file stores its fingerprint and posts feedback from the native sheet', async ({
  app,
  environments,
}) => {
  const environment = await environments.start('Review');
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: '/api/inventory',
      })
    ).body,
  );
  const project = inventory.projects[0];
  const worktree = project?.worktrees.find((entry) => entry.main);
  if (!project || !worktree)
    throw new Error('The review fixture has no main worktree.');
  const base = `/api/worktrees/${encodeURIComponent(worktree.id)}`;
  const before = Schema.decodeUnknownSync(readChangesResponseSchema)(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: `${base}/changes`,
      })
    ).body,
  );
  const expectedFingerprint = before.changes.find(
    (file) => file.path === 'README.md',
  )?.fingerprint;
  if (!expectedFingerprint)
    throw new Error('The review fixture has no fingerprint for README.md.');
  expect(
    await app.run('review.yaml', {
      PAIRING_LINK: environment.link,
      ENVIRONMENT_NAME: environment.name,
      PROJECT_NAME: project.name,
      WORKTREE_LABEL: worktreeLabel(worktree.branch),
    }),
  ).toEqual({
    name: 'Review a file, mark it reviewed and post native feedback',
    status: 'passed',
  });
  const marks = Schema.decodeUnknownSync(listReviewedFilesResponseSchema)(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: `${base}/reviewed`,
      })
    ).body,
  );
  expect(
    marks.marks.map((mark) => ({
      path: mark.path,
      fingerprint: mark.fingerprint,
    })),
  ).toEqual([{ path: 'README.md', fingerprint: expectedFingerprint }]);
  const threads = Schema.decodeUnknownSync(listCommentThreadsResponseSchema)(
    (
      await environment.server.read(environment.recorder, {
        method: 'GET',
        path: `${base}/comments`,
        query: { scope: 'all' },
      })
    ).body,
  );
  expect(
    threads.map((thread) => ({
      anchor: thread.anchor,
      body: thread.messages[0]?.body,
      author: thread.messages[0]?.author,
    })),
  ).toEqual([
    {
      anchor: {
        kind: 'file',
        filePath: 'README.md',
        comparison: { kind: 'worktree', scope: 'unstaged' },
        contentFingerprint: expectedFingerprint,
      },
      body: 'Please explain this change.',
      author: 'reviewer',
    },
  ]);
});
