import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

async function addRemoteComputer(page: Page, link: string, name: string) {
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(link);
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    settings
      .getByRole('list', { name: 'Remote computers', exact: true })
      .getByRole('listitem', { name, exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    page
      .getByRole('group', { name, exact: true })
      .getByText('Online', { exact: true }),
  ).toBeVisible();
}

const paths = (inventory: {
  projects: readonly { worktrees: readonly { path: string }[] }[];
}) =>
  inventory.projects.flatMap((project) =>
    project.worktrees.map((worktree) => worktree.path),
  );

test('the desktop app opens a project on another computer from the Open project menu and shows its worktree', async ({
  pairedPage,
  app,
  server,
  remote,
}) => {
  const other = await remote.server.inventory();
  const elsewhere = await remote.projectHome.repository('elsewhere');

  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await settings
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    settings
      .getByRole('list', { name: 'Remote computers', exact: true })
      .getByRole('listitem', { name: other.environment.name, exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    pairedPage
      .getByRole('group', { name: other.environment.name, exact: true })
      .getByText('Online', { exact: true }),
  ).toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Open project', exact: true })
    .click();
  const menu = pairedPage.getByRole('menu');
  await expect(
    menu.getByRole('menuitem', { name: 'This computer', exact: true }),
  ).toBeEnabled();
  await menu
    .getByRole('menuitem', { name: other.environment.name, exact: true })
    .click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Open project',
    exact: true,
  });
  await expect(
    dialog.getByText(`Browse for a repository on ${other.environment.name}.`, {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'elsewhere', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Open elsewhere', exact: true })
    .click();
  await expect(dialog).not.toBeAttached();

  await expect
    .poll(async () => paths(await remote.server.inventory()))
    .toContain(elsewhere);
  await expect
    .poll(async () => paths(await server.inventory()))
    .not.toContain(elsewhere);
  const project = (await remote.server.inventory()).projects.find((entry) =>
    entry.worktrees.some((worktree) => worktree.path === elsewhere),
  );
  const worktree = project?.worktrees.find((entry) => entry.available);
  await expect
    .poll(() => app.address().path)
    .toBe(
      `/remotes/${other.environmentId}/${project?.id ?? ''}/${worktree?.id ?? ''}`,
    );
  await expect(
    pairedPage
      .getByRole('group', { name: other.environment.name, exact: true })
      .getByRole('button', { name: 'elsewhere', exact: true }),
  ).toBeVisible();
});

test('This computer in the Open project menu still opens a project on this computer', async ({
  projectHome,
  pairedPage,
  app,
  server,
  remote,
}) => {
  const here = await projectHome.repository('here');
  await addRemoteComputer(
    pairedPage,
    await app.remoteLink(),
    (await remote.server.inventory()).environment.name,
  );
  await pairedPage
    .getByRole('button', { name: 'Open project', exact: true })
    .click();
  await pairedPage
    .getByRole('menu')
    .getByRole('menuitem', { name: 'This computer', exact: true })
    .click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Open project',
    exact: true,
  });
  await expect(
    dialog.getByText('Browse for a repository on the Porcelain server.', {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'here', exact: true }).click();
  await dialog.getByRole('button', { name: 'Open here', exact: true }).click();
  await expect(dialog).not.toBeAttached();

  await expect
    .poll(async () => paths(await server.inventory()))
    .toContain(here);
  await expect
    .poll(async () => paths(await remote.server.inventory()))
    .not.toContain(here);
  const project = (await server.inventory()).projects.find((entry) =>
    entry.worktrees.some((worktree) => worktree.path === here),
  );
  const worktree = project?.worktrees.find((entry) => entry.available);
  await expect
    .poll(() => app.address().path)
    .toBe(`/${project?.id ?? ''}/${worktree?.id ?? ''}`);
  await expect(
    pairedPage
      .getByRole('group', { name: 'This computer', exact: true })
      .getByRole('button', { name: 'here', exact: true }),
  ).toBeVisible();
});
