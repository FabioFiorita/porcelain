import { expect, test } from './fixtures.ts';

test('Open graph opens the commit graph as a tab that comes back after a reload, and clicking the merge commit in it opens its document', async ({
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

  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'History', exact: true }).click();
  await opened.getByRole('button', { name: 'Open graph', exact: true }).click();
  await expect(opened.getByRole('tab', { name: /^Graph/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const graph = opened.getByRole('list', { name: 'Commit graph', exact: true });
  await expect(
    graph.getByRole('img', { name: 'Merge commit', exact: true }),
  ).toBeVisible();
  await expect(graph.getByText('topic', { exact: true })).toBeVisible();

  await app.reload();

  await expect(opened.getByRole('tab', { name: /^Graph/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await opened
    .getByRole('list', { name: 'Commit graph', exact: true })
    .getByRole('button', { name: /^Merge commit ?Merge branch 'topic'/ })
    .click();
  await expect(
    opened.getByRole('heading', { name: /^Merge branch 'topic'/ }),
  ).toBeVisible();
  await expect(opened.getByRole('tab', { name: /^Graph/ })).toHaveAttribute(
    'aria-selected',
    'false',
  );
});
