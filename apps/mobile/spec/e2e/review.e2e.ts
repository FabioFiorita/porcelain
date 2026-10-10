import { Schema } from 'effect';
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
  expect(
    await app.run('review.yaml', {
      PAIRING_LINK: environment.link,
      ENVIRONMENT_NAME: environment.name,
      PROJECT_NAME: project.name,
      WORKTREE_LABEL: worktree.branch ?? 'Detached HEAD',
    }),
  ).toEqual({
    name: 'Review a file, mark it reviewed and post native feedback',
    status: 'passed',
  });
  const base = `/api/worktrees/${encodeURIComponent(worktree.id)}`;
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
      hasFingerprint: mark.fingerprint.length > 0,
    })),
  ).toEqual([{ path: 'README.md', hasFingerprint: true }]);
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
      kind: thread.anchor.kind,
      file: thread.anchor.filePath,
      body: thread.messages[0]?.body,
      author: thread.messages[0]?.author,
    })),
  ).toEqual([
    {
      kind: 'file',
      file: 'README.md',
      body: 'Please explain this change.',
      author: 'reviewer',
    },
  ]);
});
