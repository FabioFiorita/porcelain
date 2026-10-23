import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`sidebar and completion disclose ignored-file deletion at ${width}px in ${colorScheme}`, async ({
      pairedPage,
      server,
      app,
    }) => {
      const project = await server.project();
      const main = project.worktrees.find((row) => row.main)?.path;
      if (!main) throw new Error('Missing main checkout');
      const fixture = await archiveFixture(main);
      await pairedPage.setViewportSize({ width, height: 896 });
      await pairedPage.emulateMedia({ colorScheme });
      await app.reload();
      if (width === 414)
        await pairedPage
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      await pairedPage
        .getByRole('button', { name: 'Closed reviews', exact: true })
        .click();
      const row = pairedPage.getByRole('listitem').filter({
        has: pairedPage.getByRole('link', {
          name: /Completed archive fixture/,
        }),
      });
      const dialog = pairedPage.getByRole('alertdialog', {
        name: 'Archive review?',
        exact: true,
      });
      await row.getByRole('button', { name: 'Archive', exact: true }).click();
      await expect(dialog).toContainText(
        'The entire worktree folder will be permanently deleted, including ignored files such as .env and local build output.',
      );
      await expect(dialog.getByRole('switch')).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect
        .poll(() => fixture.ignoredFile())
        .toBe('LOCAL_ONLY=archive-fixture\n');
      await row.getByRole('link').click();
      await pairedPage
        .getByRole('button', { name: 'Not explained', exact: true })
        .click();
      await pairedPage
        .getByRole('region', { name: 'Review completion', exact: true })
        .getByRole('button', { name: 'Archive', exact: true })
        .click();
      await expect(dialog).toContainText(
        'The entire worktree folder will be permanently deleted, including ignored files such as .env and local build output.',
      );
      await expect(
        dialog.getByRole('button', { name: 'Archive review', exact: true }),
      ).toBeEnabled();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect
        .poll(() => fixture.ignoredFile())
        .toBe('LOCAL_ONLY=archive-fixture\n');
    });
  }
}

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
  await expect(dialog).toContainText(
    'The entire worktree folder will be permanently deleted, including ignored files such as .env and local build output.',
  );
  await expect(dialog).not.toContainText('Warning:');
  await expect(dialog.getByRole('switch')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(() => fixture.ignoredFile())
    .toBe('LOCAL_ONLY=archive-fixture\n');
  await row.getByRole('button', { name: 'Archive', exact: true }).click();
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
