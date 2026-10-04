import { expect, test } from './fixtures.ts';
import { prepareReview } from './review-workspace.ts';

test('Review reads native diffs and opens and dismisses its comments sheet inside the iPad split', async ({
  app,
  environments,
}) => {
  const environment = await environments.start('Review', { workspace: true });
  const review = await prepareReview(environment);
  const result = await app.run('review.yaml', {
    REVIEW_LINK: app.link('/'),
    FILE_PATH: review.path,
    BRANCH_FILE_PATH: review.branchPath,
    PROJECT_NAME: `${environment.name} project`,
    ENVIRONMENT_NAME: environment.name,
    PAIRING_LINK: environment.link,
  });
  expect(result.status).toBe('passed');
  expect(
    (await environment.nativeHits('GET', '/api/worktrees/:worktreeId/review'))
      .length,
  ).toBeGreaterThan(0);
  expect(
    (
      await environment.nativeHits(
        'GET',
        '/api/worktrees/:worktreeId/branch-changes',
      )
    ).length,
  ).toBeGreaterThan(0);
});
