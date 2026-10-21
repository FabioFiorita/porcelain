import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';

test('Closed keeps Archive inside the review row, ignores dependencies, and explains worktree removal failures without a stale checking state', async ({
  pairedPage,
  server,
  app,
}) => {
  const project = await server.project();
  const main = project.worktrees.find((row) => row.main)?.path;
  if (!main) throw new Error('Missing main checkout');
  const fixture = await archiveFixture(main);
  await app.reload();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Closed reviews', exact: true })
    .click();
  const row = pairedPage.getByRole('listitem').filter({
    has: pairedPage.getByRole('link', { name: /Completed archive fixture/ }),
  });
  await row.getByRole('button', { name: 'Archive', exact: true }).click();
  const dialog = pairedPage.getByRole('alertdialog', {
    name: 'Archive review?',
    exact: true,
  });
  await expect(dialog).toContainText(`Delete worktree: ${fixture.tree}`);
  await expect(dialog).not.toContainText('Warning:');
  await expect(
    dialog.getByRole('button', { name: 'Archive review', exact: true }),
  ).toBeEnabled();
  fixture.lock();
  await dialog
    .getByRole('button', { name: 'Archive review', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText(
    `Could not delete worktree ${fixture.tree}. Deleted: nothing.`,
  );
  await expect(dialog).not.toContainText('ReviewArchiveRefusedError:');
  await expect(dialog).not.toContainText('Checking the worktree and branches');
  await expect.poll(() => fixture.exists()).toBe(true);
  await expect
    .poll(() => fixture.remoteBranch())
    .toContain('refs/heads/archive-fixture');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Closed reviews', exact: true })
    .click();
  fixture.unlock();
  fixture.dirty();
  await row.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(dialog).toContainText('uncommitted changes');
  await expect(
    dialog.getByRole('button', { name: 'Archive review', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('switch', {
      name: 'I understand the risk of losing changes and commits',
      exact: true,
    })
    .click();
  await dialog
    .getByRole('button', { name: 'Archive review', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const closed = pairedPage.getByRole('button', {
    name: 'Closed reviews',
    exact: true,
  });
  if (await closed.isVisible()) await closed.click();
  await expect(
    pairedPage.getByRole('link', {
      name: /Completed archive fixture.*Archived/,
    }),
  ).toBeVisible();
  await expect.poll(() => fixture.exists()).toBe(false);
});
