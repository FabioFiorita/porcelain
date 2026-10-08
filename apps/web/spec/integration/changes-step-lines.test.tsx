import { expect, test, type Agent, type Render } from './fixtures.tsx';

const layer = 'Readme walkthrough';
const step = /^Step /;

async function openStep(agent: Agent, render: Render) {
  await agent.publishReview(layer, 'context');
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Review', exact: true }).click();
  await opened
    .getByRole('button', { name: `1. ${layer}`, exact: true })
    .click();
  return opened;
}

test('a review step that points at worktree lines shows those lines from disk', async ({
  render,
  agent,
}) => {
  const opened = await openStep(agent, render);
  const code = opened.getByRole('article', { name: step, exact: true });
  await expect
    .element(code.getByText('A change to review.', { exact: true }))
    .toBeVisible();
});

test('a review step whose lines another writer changed says so instead of showing stale lines', async ({
  agent,
  render,
  repo,
  server,
}) => {
  const page = await openStep(agent, render);
  const code = page.getByRole('article', { name: step, exact: true });
  await expect
    .element(code.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await repo.write(repo.readme.path, '# Sample repository\n\nRewritten.\n');
  await expect
    .poll(
      async () =>
        (await server.publishedReview()).review?.layers[0]?.steps[0]?.location
          .state,
    )
    .toBe('changed');
  await expect
    .element(
      code.getByText('Code changed since the review was written.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(code.getByText('A change to review.', { exact: true }))
    .not.toBeInTheDocument();
});
