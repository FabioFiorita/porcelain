import { expect, test } from './fixtures.ts';
import { prepareReview } from './review-workspace.ts';

test('Review reads the selected worktree diff, reviewed state, published layers and comments on iPhone', async ({
  app,
  environments,
}) => {
  const environment = await environments.start('Review', { workspace: true });
  const review = await prepareReview(environment);
  expect(
    await app.run('review.yaml', {
      PAIRING_LINK: environment.link,
      ENVIRONMENT_NAME: environment.name,
      PROJECT_NAME: `${environment.name} project`,
      FILE_PATH: review.path,
      BRANCH_FILE_PATH: review.branchPath,
      REVIEW_LINK: app.link('/'),
    }),
  ).toEqual({
    name: 'Read changed files diffs published layers and comments',
    status: 'passed',
  });
  expect(
    (
      await environment.nativeHits(
        'POST',
        '/api/worktrees/:worktreeId/changes/diffs',
      )
    ).map((hit) => hit.path),
  ).toEqual([`/api/worktrees/${review.worktreeId}/changes/diffs`]);
  expect(
    (await environment.nativeHits('GET', '/api/worktrees/:worktreeId/comments'))
      .length,
  ).toBeGreaterThan(0);
});
