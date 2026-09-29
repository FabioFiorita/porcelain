import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the timeline of a renamed file lists its commits across the rename and opens the diff of one', async ({
  pairedPage,
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

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  await pairedPage.getByRole('treeitem', { name: guide }).click();
  await pairedPage.getByRole('button', { name: 'Timeline' }).click();
  const timeline = pairedPage.getByRole('list', {
    name: `Timeline of ${guide}`,
  });
  await expect
    .element(timeline.getByText(`Renamed from ${readme}`))
    .toBeVisible();
  await expect
    .element(timeline.getByText(`Modified as ${readme}`))
    .toBeVisible();
  await expect.element(timeline.getByText(`Added as ${readme}`)).toBeVisible();
  await expect
    .element(timeline.getByText('Start of this file’s history.'))
    .toBeVisible();

  await timeline.getByRole('button', { name: explained, exact: false }).click();
  await expect
    .element(pairedPage.getByRole('heading', { name: explained }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByText('A change to review.'))
    .toBeVisible();
});

test('the file tree opens the timeline of a file', async ({ pairedPage }) => {
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  await pairedPage
    .getByRole('treeitem', { name: 'guide.md' })
    .click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Show timeline' }).click();
  await expect
    .element(
      pairedPage
        .getByRole('list', { name: 'Timeline of guide.md' })
        .getByRole('button', {
          name: 'Move the readme to the guide',
          exact: false,
        }),
    )
    .toBeVisible();
});
