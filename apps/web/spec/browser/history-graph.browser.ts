import { expect } from 'vitest';
import { test } from '../kit/journey';

const mergeNode = { x: 13, y: 29 };

test('Open graph opens the commit graph as a tab that comes back after a reload, and clicking a node opens that commit', async ({
  app,
  repo,
  server,
}) => {
  await repo.branch('topic');
  await repo.switch('topic');
  await repo.write('topic.md', '# Topic\n');
  await repo.commit('Add the topic notes');
  await repo.switch(repo.initialBranch);
  await repo.write('steps.md', '# Steps\n');
  await repo.commit('Write the review steps');
  await repo.merge('topic');
  await expect
    .poll(async () => (await server.commits()).commits[0]?.parentOids.length)
    .toBe(2);

  const opened = await app.openReloadable(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'History' }).click();
  await opened.getByRole('button', { name: 'Open graph' }).click();
  await expect
    .element(opened.getByRole('tab', { name: /^Graph/ }))
    .toHaveAttribute('aria-selected', 'true');
  const graph = opened.getByRole('list', { name: 'Commit graph' });
  await expect
    .element(graph.getByRole('img', { name: 'Merge commit' }))
    .toBeVisible();
  await expect.element(graph.getByText('topic', { exact: true })).toBeVisible();

  await app.reload();

  await expect
    .element(opened.getByRole('tab', { name: /^Graph/ }))
    .toHaveAttribute('aria-selected', 'true');
  await opened
    .getByRole('list', { name: 'Commit graph' })
    .getByRole('button', { name: "Merge branch 'topic'", exact: false })
    .click({ position: mergeNode });
  await expect
    .element(opened.getByRole('heading', { name: /^Merge branch 'topic'/ }))
    .toBeVisible();
  await expect
    .element(opened.getByRole('tab', { name: /^Graph/ }))
    .toHaveAttribute('aria-selected', 'false');
});
