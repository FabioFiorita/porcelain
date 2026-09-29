import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a pinned file is listed under Pinned, opens from there, and unpins', async ({
  pairedPage,
  repo,
  server,
}) => {
  const path = 'guide.md';
  await repo.write(path, '# Guide\n\nPinned reading\n');
  const pinned = async () =>
    (await server.filePreferences()).preferences
      .filter((preference) => preference.pinned)
      .map((preference) => preference.path);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  const file = pairedPage.getByRole('treeitem', { name: 'guide.md' });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Pin file' }).click();

  const group = pairedPage.getByRole('region', { name: 'Pinned files' });
  await expect.element(group.getByText('guide.md')).toBeVisible();
  await expect.poll(pinned).toEqual([path]);

  await pairedPage.getByRole('treeitem', { name: repo.readme.path }).click();
  await expect
    .element(pairedPage.getByText('A change to review.'))
    .toBeVisible();
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  await group
    .getByRole('button', { name: /guide\.md/ })
    .first()
    .click();
  await expect.element(pairedPage.getByText('Pinned reading')).toBeVisible();

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  await pairedPage.getByRole('button', { name: `Unpin ${path}` }).click();
  await expect.element(group).not.toBeInTheDocument();
  await expect.poll(pinned).toEqual([]);
});
