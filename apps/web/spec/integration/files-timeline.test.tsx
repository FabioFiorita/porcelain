import { expect, test } from './fixtures.tsx';

test('the timeline of a renamed file lists its commits across the rename and opens the diff of one', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const guide = 'guide.md';
  const explained = 'Explain the change to review';
  const moved = 'Move the readme to the guide';
  await repo.commit(explained);
  await repo.write(guide, await repo.read(readme));
  await repo.remove(readme);
  await repo.commit(moved);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(moved);

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace.getByRole('treeitem', { name: guide, exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Timeline', exact: true })
    .click();
  const timeline = workspace.getByRole('list', {
    name: `Timeline of ${guide}`,
    exact: true,
  });
  await expect
    .element(timeline.getByText(`Renamed from ${readme}`, { exact: true }))
    .toBeVisible();
  await expect
    .element(timeline.getByText(`Modified as ${readme}`, { exact: true }))
    .toBeVisible();
  await expect
    .element(timeline.getByText(`Added as ${readme}`, { exact: true }))
    .toBeVisible();
  await expect
    .element(
      timeline.getByText('Start of this file’s history.', { exact: true }),
    )
    .toBeVisible();

  await timeline
    .getByRole('button', { name: new RegExp(`^${explained}`) })
    .click();
  await expect
    .element(workspace.getByRole('heading', { name: explained, exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('A change to review.', { exact: true }))
    .toBeVisible();
});

test('the file tree opens the timeline of a file', async ({
  workspace,
  repo,
}) => {
  const readme = repo.readme.path;
  await repo.commit('Explain the change to review');
  await repo.write('guide.md', await repo.read(readme));
  await repo.remove(readme);
  await repo.commit('Move the readme to the guide');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: 'guide.md', exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Show timeline', exact: true })
    .click();
  await expect
    .element(
      workspace
        .getByRole('list', { name: 'Timeline of guide.md', exact: true })
        .getByRole('button', {
          name: /^Move the readme to the guide/,
        }),
    )
    .toBeVisible();
});
