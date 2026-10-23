import { expect, test, type Page } from './fixtures.ts';

async function addRemoteComputer(page: Page, link: string, name: string) {
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(link);
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    settings
      .getByRole('list', { name: 'Computers', exact: true })
      .getByRole('listitem', { name, exact: true }),
  ).toBeVisible();
  await settings
    .getByRole('button', { name: 'Close Settings', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name, exact: true }),
  ).not.toBeAttached();
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
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    settings
      .getByRole('list', { name: 'Computers', exact: true })
      .getByRole('listitem', { name: other.environment.name, exact: true }),
  ).toBeVisible();
  await settings
    .getByRole('button', { name: 'Close Settings', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('button', {
      name: other.environment.name,
      exact: true,
    }),
  ).not.toBeAttached();

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
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await expect(
    pairedPage
      .getByRole('group', { name: other.environment.name, exact: true })
      .getByRole('menuitem', { name: 'elsewhere', exact: true }),
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
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await expect(
    pairedPage
      .getByRole('group', { name: 'This computer', exact: true })
      .getByRole('menuitem', { name: 'here', exact: true }),
  ).toBeVisible();
});

test('the desktop sidebar renames and removes a project on another computer, and that computer keeps the change while this computer’s project still renames here', async ({
  pairedPage,
  app,
  server,
  remote,
}) => {
  const local = await server.project();
  const other = await remote.server.inventory();
  const project = await remote.server.project();
  await addRemoteComputer(
    pairedPage,
    await app.remoteLink(),
    other.environment.name,
  );
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  const there = pairedPage.getByRole('group', {
    name: other.environment.name,
    exact: true,
  });
  const here = pairedPage.getByRole('group', {
    name: 'This computer',
    exact: true,
  });
  const rename = pairedPage.getByRole('dialog', {
    name: 'Rename project',
    exact: true,
  });
  const renamed = 'Renamed on the other computer';

  await there
    .getByRole('menuitem', { name: project.name, exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Rename project', exact: true })
    .click();
  await rename
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill(renamed);
  await rename.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(rename).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await expect(
    there.getByRole('menuitem', { name: renamed, exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await remote.server.project()).name)
    .toBe(renamed);
  await expect.poll(async () => (await server.project()).name).toBe(local.name);

  const remove = pairedPage.getByRole('alertdialog', {
    name: `Remove ${renamed} from Porcelain?`,
    exact: true,
  });
  await there.getByRole('menuitem', { name: renamed, exact: true }).click();
  await pairedPage
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  await remove.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(remove).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await expect(
    there.getByRole('menuitem', { name: renamed, exact: true }),
  ).toBeVisible();

  await there.getByRole('menuitem', { name: renamed, exact: true }).click();
  await pairedPage
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  await remove
    .getByRole('button', { name: 'Remove from Porcelain', exact: true })
    .click();
  await expect(remove).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('menuitem', { name: renamed, exact: true }),
  ).not.toBeAttached();
  await expect
    .poll(async () =>
      (await remote.server.inventory()).projects.map((entry) => entry.id),
    )
    .toEqual([]);
  await expect
    .poll(async () =>
      (await server.inventory()).projects.map((entry) => entry.id),
    )
    .toEqual([local.id]);

  const named = 'Renamed on this computer';
  await here.getByRole('menuitem', { name: local.name, exact: true }).click();
  await pairedPage
    .getByRole('menuitem', { name: 'Rename project', exact: true })
    .click();
  await rename.getByRole('textbox', { name: 'Name', exact: true }).fill(named);
  await rename.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(rename).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await expect(
    here.getByRole('menuitem', { name: named, exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await server.project()).name).toBe(named);
});

test('a rename dialog for another computer’s project is disabled with the reason once that computer stops accepting this app', async ({
  pairedPage,
  app,
  remote,
}) => {
  const other = await remote.server.inventory();
  const project = await remote.server.project();
  await addRemoteComputer(
    pairedPage,
    await app.remoteLink(),
    other.environment.name,
  );
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await pairedPage
    .getByRole('group', { name: other.environment.name, exact: true })
    .getByRole('menuitem', { name: project.name, exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Rename project', exact: true })
    .click();
  const rename = pairedPage.getByRole('dialog', {
    name: 'Rename project',
    exact: true,
  });
  const submit = rename.getByRole('button', { name: 'Rename', exact: true });
  await expect(submit).toBeEnabled();

  const device = (await remote.server.devices()).find(
    (entry) => entry.label === 'Remote computer',
  );
  if (device === undefined) throw new Error('The remote paired no device');
  await app.revokeDevice(device.id);
  await expect(rename.getByRole('alert')).toHaveText(
    'Needs pairing. It no longer accepts this app. Run porcelain pair on it and add the new link.',
    { timeout: 20_000 },
  );
  await expect(submit).toBeDisabled();
  await rename.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(rename).not.toBeAttached();
  await expect
    .poll(async () => (await remote.server.project()).name)
    .toBe(project.name);
});
