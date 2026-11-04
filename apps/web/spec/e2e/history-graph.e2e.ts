import { readHistoryGeometry } from '../kit/history-geometry.ts';
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

test('shared merge parents keep continuous ancestry in History and Graph', async ({
  app,
  repo,
  server,
}) => {
  await repo.branch('topic');
  await repo.switch('topic');
  await repo.write('topic.md', '# Topic\n');
  await repo.commit('Topic work');
  await repo.switch(repo.initialBranch);
  await repo.write('main.md', '# Main\n');
  await repo.commit('Main continues');
  await repo.switch('topic');
  await repo.merge(repo.initialBranch);
  await repo.switch(repo.initialBranch);
  await repo.merge('topic');
  const { commits } = await server.commits();
  await expect
    .poll(async () => (await server.commits()).commits.length)
    .toBe(5);

  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'History', exact: true }).click();
  const expected = commits.map((commit) => [...commit.parentOids].sort());
  const assertAncestry = async (name: string) => {
    const area = opened.getByRole('region', { name, exact: true });
    await expect(area).toBeVisible();
    await expect
      .poll(async () => {
        const observed = await area.evaluate(readHistoryGeometry);
        return {
          dangling: observed.dangling,
          parents: observed.parents.map((indices) =>
            indices.map((index) => commits[index]?.oid).sort(),
          ),
        };
      })
      .toEqual({ dangling: [], parents: expected });
  };
  await expect(
    opened
      .getByRole('list', { name: 'Commits', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(5);
  await assertAncestry('History reading area');
  await opened.getByRole('button', { name: 'Open graph', exact: true }).click();
  await assertAncestry('Graph reading area');
});
