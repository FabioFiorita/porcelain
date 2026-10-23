import { expect, test, type Agent, type Render } from './fixtures.tsx';

const layer = 'Readme walkthrough';
const step = /^Step /;

async function openStep(agent: Agent, render: Render) {
  await agent.publishReview(layer, 'context');
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Review', exact: true })
    .click();
  await opened
    .getByRole('button', { name: `1 ${layer} 0/0`, exact: true })
    .click();
  return opened;
}

test('a retained review pointer and text stay fixed after a worktree edit', async ({
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
    .toBe('current');
  await expect
    .element(code.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await expect
    .element(code.getByText('Rewritten.', { exact: true }))
    .not.toBeInTheDocument();
});
