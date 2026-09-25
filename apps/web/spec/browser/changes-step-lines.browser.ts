import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { test } from '../kit/journey';

const layer = 'Readme walkthrough';
const step = /^Step /;

test('a review step that points at worktree lines shows those lines from disk', async ({
  app,
  agent,
}) => {
  await agent.publishReview(layer, 'context');
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('button', { name: `1. ${layer}` }).click();
  const code = opened.getByRole('article', { name: step });
  await expect.element(code.getByText('A change to review.')).toBeVisible();
});

test('a review step whose lines another writer changed says so instead of showing stale lines', async ({
  repo,
  server,
}) => {
  const code = page.getByRole('article', { name: step });
  await expect.element(code.getByText('A change to review.')).toBeVisible();
  await repo.write(repo.readme.path, '# Sample repository\n\nRewritten.\n');
  await expect
    .poll(
      async () =>
        (await server.publishedReview()).review?.layers[0]?.steps[0]?.location
          .state,
    )
    .toBe('changed');
  await expect
    .element(code.getByText('Code changed since the review was written.'))
    .toBeVisible();
  await expect
    .element(code.getByText('A change to review.'))
    .not.toBeInTheDocument();
});
