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

test('a long timeline change line is clipped inside its row and discloses its full text', async ({
  workspace,
  repo,
}) => {
  const long = `${'an-extremely-long-file-name-'.repeat(4)}notes.md`;
  const notes = 'notes.md';
  await repo.write(long, 'Notes\n');
  await repo.commit('Add the long notes');
  await repo.write(notes, await repo.read(long));
  await repo.remove(long);
  await repo.commit('Shorten the notes name');

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace.getByRole('treeitem', { name: notes, exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Timeline', exact: true })
    .click();
  const change = workspace
    .getByRole('list', { name: `Timeline of ${notes}`, exact: true })
    .getByText(`Renamed from ${long}`, { exact: true });
  await expect.element(change).toBeVisible();
  await expect.element(change).toHaveAttribute('data-clipped', '');
});
