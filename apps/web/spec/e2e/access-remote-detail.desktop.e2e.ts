import { expect, test, type Page } from './fixtures.ts';
import { replaceEditorContent } from '../kit/editor.ts';

async function openRemotes(page: Page) {
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
}

async function openComputer(page: Page, name: string) {
  const row = page.getByRole('listitem', { name, exact: true });
  await expect(row.getByRole('button')).toBeVisible();
  await row.getByRole('button').click();
}

test('a computer detail uses its identity, reloads directly, and Back and the breadcrumb preserve list search, filter, scroll and focus', async ({
  pairedPage: page,
  app,
  remote,
}) => {
  const inventory = await remote.server.inventory();
  const name = inventory.environment.name;
  await openRemotes(page);
  await page.setViewportSize({ width: 1100, height: 360 });
  await page
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const row = page.getByRole('listitem', { name, exact: true });
  await expect(row).toBeVisible();
  await expect(row).toContainText(inventory.environmentId.slice(0, 8));
  await expect(
    row.getByRole('button', { name: /Forget|Update/ }),
  ).not.toBeAttached();
  const search = page.getByRole('textbox', {
    name: 'Search remote computers',
    exact: true,
  });
  await search.fill('not this computer');
  await expect(row).not.toBeAttached();
  await expect(
    page.getByText('No computers match this search and filter.', {
      exact: true,
    }),
  ).toBeVisible();
  await search.fill(name);
  await page
    .getByRole('combobox', { name: 'Computer status', exact: true })
    .click();
  await page.getByRole('option', { name: 'Offline', exact: true }).click();
  await expect(row).not.toBeAttached();
  await page
    .getByRole('combobox', { name: 'Computer status', exact: true })
    .click();
  await page.getByRole('option', { name: 'Online', exact: true }).click();
  const list = page.getByRole('region', {
    name: 'Remote computers list',
    exact: true,
  });
  await row.getByRole('button').focus();
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const scroll = await list.evaluate((element) => element.scrollTop);
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await openComputer(page, name);
  const detail = `/settings/remotes/${inventory.environmentId}`;
  await expect(page).toHaveURL(new RegExp(`${detail}$`));
  await expect(
    page.getByRole('navigation', { name: 'breadcrumb', exact: true }),
  ).toContainText(name);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(search).toHaveValue(name);
  await expect(row.getByRole('button')).toBeFocused();
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBe(scroll);
  await expect(
    page.getByRole('combobox', { name: 'Computer status', exact: true }),
  ).toContainText('Online');
  await openComputer(page, name);
  await page
    .getByRole('navigation', { name: 'breadcrumb', exact: true })
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
  await expect(search).toHaveValue(name);
  await expect(row.getByRole('button')).toBeFocused();
  await openComputer(page, name);
  await page.goBack();
  await expect(search).toHaveValue(name);
  await expect(row.getByRole('button')).toBeFocused();
  await app.follow(detail);
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await app.reload();
  await expect(page).toHaveURL(new RegExp(`${detail}$`));
  await expect(
    page.getByText(inventory.environmentId, { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/remotes$/);
});

test('sidebar menus and outage links open the exact computer, saved offline details are stale, and settings leave the current review intact', async ({
  pairedPage: page,
  app,
  remote,
}) => {
  const inventory = await remote.server.inventory();
  const name = inventory.environment.name;
  const workspace = page.url();
  await openRemotes(page);
  const link = await app.remoteLink();
  const origin = new URL(link).origin;
  await page
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(link);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await openComputer(page, name);
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(workspace);
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const machine = page.getByRole('group', { name, exact: true });
  await machine
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click({ button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: 'Computer settings', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('menuitem', { name: 'Computer settings', exact: true })
    .click();
  const detail = `/settings/remotes/${inventory.environmentId}`;
  await expect(page).toHaveURL(new RegExp(`${detail}$`));
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(workspace);
  const restore = await app.failRemoteStatus(link);
  try {
    await app.reload();
    await page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
    await expect(
      machine.getByRole('button', { name: 'Computer settings', exact: true }),
    ).toBeVisible();
    await machine
      .getByRole('button', { name: 'Computer settings', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${detail}$`));
    await expect(page.getByText('Offline', { exact: true })).toBeVisible();
    await expect(page.getByText(/Saved details · Stale/)).toBeVisible();
    await expect(page.getByText(origin, { exact: true })).toBeVisible();
    await expect(
      page.getByText(inventory.environmentId, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Update to/ }),
    ).not.toBeAttached();
    await app.reload();
    await expect(page).toHaveURL(new RegExp(`${detail}$`));
    await expect(page.getByText('Offline', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/does not revoke host credentials or stop sharing/),
    ).toBeVisible();
    const project = await remote.server.project();
    await app.follow(
      `/remotes/${inventory.environmentId}/${project.id}/${project.worktrees[0]?.id ?? ''}`,
    );
    await expect(
      page
        .getByRole('button', { name: 'Computer settings', exact: true })
        .last(),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Computer settings', exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(new RegExp(`${detail}$`));
  } finally {
    await restore();
  }
});

test('forgetting from detail refuses an unsavable remote draft and leaves the computer, draft and disk change intact', async ({
  pairedPage: page,
  app,
  remote,
}) => {
  const inventory = await remote.server.inventory();
  const project = await remote.server.project();
  await openRemotes(page);
  await page
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await openComputer(page, inventory.environment.name);
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  const worktree = project.worktrees.find((item) => item.main);
  const workspace = `/remotes/${inventory.environmentId}/${project.id}/${worktree?.id ?? ''}`;
  await app.follow(workspace);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  const readme = remote.repo.readme.path;
  await page
    .getByRole('treeitem', { name: readme, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open file', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: readme, exact: true });
  await expect(editor).toBeVisible();
  const disk = 'A newer change on the remote disk\n';
  await remote.repo.write(readme, disk);
  await replaceEditorContent(editor, 'Keep this unsaved remote draft');
  await expect(
    page.getByText('Not saving: changed on disk', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const machine = page.getByRole('group', {
    name: inventory.environment.name,
    exact: true,
  });
  await machine
    .getByRole('button', { name: new RegExp(`^${inventory.environment.name}`) })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Computer settings', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Forget on this app', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Forget on this app', exact: true })
    .click();
  await expect(page.getByRole('alert')).toHaveText(
    'Save or discard unsaved file drafts before disconnecting.',
  );
  await expect(page).toHaveURL(
    new RegExp(`/settings/remotes/${inventory.environmentId}$`),
  );
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    page.getByRole('listitem', {
      name: inventory.environment.name,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${workspace}\\?`));
  await page.getByRole('button', { name: 'Resume edit', exact: true }).click();
  await expect(editor).toHaveText('Keep this unsaved remote draft');
  await expect
    .poll(async () => (await remote.server.text(readme)).text)
    .toBe(disk);
});
