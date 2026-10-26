import { expect, test } from './fixtures.ts';

test("a removed project's worktree address says the worktree is no longer present instead of opening another project", async ({
  app,
  pairedPage,
  projectHome,
  server,
}) => {
  const sample = await server.project();
  const removed = app.address();
  await projectHome.repository('other');
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Open project', exact: true })
    .click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Open project',
    exact: true,
  });
  await dialog.getByRole('button', { name: 'other', exact: true }).click();
  await dialog.getByRole('button', { name: 'Open other', exact: true }).click();
  await expect(dialog).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Manage projects', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: sample.name, exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  const confirm = pairedPage.getByRole('alertdialog', {
    name: `Remove ${sample.name} from Porcelain?`,
    exact: true,
  });
  await confirm
    .getByRole('button', { name: 'Remove from Porcelain', exact: true })
    .click();
  await expect(confirm).not.toBeAttached();
  await expect
    .poll(async () =>
      (await server.inventory()).projects.map((entry) => entry.id),
    )
    .not.toContain(sample.id);
  await expect(
    pairedPage.getByRole('menuitem', { name: sample.name, exact: true }),
  ).not.toBeAttached();

  await app.open(`${removed.path}${removed.query}`);

  await expect(
    pairedPage.getByText('Worktree not found', { exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('region', { name: 'Review content', exact: true }),
  ).not.toBeAttached();
  await expect.poll(() => app.address().path).toBe('/');
});
