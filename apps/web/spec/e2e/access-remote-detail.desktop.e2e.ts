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

for (const entry of ['list', 'direct']) {
  test(`Forget from ${entry} detail restores list focus and Escape returns to the workspace`, async ({
    pairedPage: page,
    app,
    remote,
  }) => {
    const inventory = await remote.server.inventory();
    const workspace = page.url();
    await openRemotes(page);
    await page
      .getByRole('textbox', { name: 'Pairing link', exact: true })
      .fill(await app.remoteLink());
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    if (entry === 'direct') {
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page).toHaveURL(workspace);
      await app.follow(`/settings/remotes/${inventory.environmentId}`);
    } else await openComputer(page, inventory.environment.name);
    await page
      .getByRole('button', { name: 'Forget on this app', exact: true })
      .click();
    await expect(
      page.getByText('No remote computers yet', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Remote computers list', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect
      .poll(() => app.address().path)
      .toBe(new URL(workspace).pathname);
  });
}

test('direct detail URLs recover a missing computer and explain both ways to clear drafts before Forget', async ({
  pairedPage: page,
  app,
  remote,
}) => {
  const inventory = await remote.server.inventory();
  await app.follow('/settings/remotes/not-saved');
  await expect(
    page.getByText(
      'This computer is no longer saved on this app. Return to Remote computers to add it again.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/remotes$/);
  await page
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await openComputer(page, inventory.environment.name);
  await expect(
    page.getByRole('group', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 480, height: 800 });
  const explanation = page.getByText(
    'Removes this computer and its saved credential from this app. It does not revoke host credentials or stop sharing on that computer. Save or discard unsaved file drafts before forgetting this computer.',
    { exact: true },
  );
  await expect(explanation).toBeVisible();
  await expect
    .poll(() =>
      explanation.evaluate(
        (element) => element.clientHeight >= element.scrollHeight,
      ),
    )
    .toBe(true);
});

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
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${detail}$`));
  await page.goBack();
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
  await page.goBack();
  await expect(page).toHaveURL(workspace);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${detail}$`));
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/remotes$/);
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

test('forgetting from detail protects an unsavable remote draft and succeeds after discarding it without revoking host access', async ({
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
    .press('Enter');
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
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(editor).not.toBeAttached();
  await expect(page.getByText(disk.trim(), { exact: true })).toBeVisible();
  const deviceIds = (await remote.server.devices()).map((device) => device.id);
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await machine
    .getByRole('button', { name: new RegExp(`^${inventory.environment.name}`) })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Computer settings', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Forget on this app', exact: true })
    .press('Enter');
  await expect(page).toHaveURL(/\/settings\/remotes$/);
  await expect(
    page.getByText('No remote computers yet', { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await remote.server.devices()).map((device) => device.id),
    )
    .toEqual(deviceIds);
  await expect
    .poll(async () => (await remote.server.text(readme)).text)
    .toBe(disk);
});

for (const status of ['online', 'offline']) {
  for (const activation of ['click', 'Tab+Enter']) {
    test(`Escape immediately returns from ${status} computer detail opened by ${activation}`, async ({
      pairedPage: page,
      app,
      remote,
    }) => {
      const inventory = await remote.server.inventory();
      const name = inventory.environment.name;
      await openRemotes(page);
      const link = await app.remoteLink();
      await page
        .getByRole('textbox', { name: 'Pairing link', exact: true })
        .fill(link);
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      const row = page
        .getByRole('listitem', { name, exact: true })
        .getByRole('button');
      await expect(row).toBeVisible();
      const restore =
        status === 'offline' ? await app.failRemoteStatus(link) : undefined;
      try {
        if (status === 'offline') await app.reload();
        await expect(row).toBeVisible();
        if (activation === 'click') await row.click();
        else {
          await page
            .getByRole('textbox', {
              name: 'Search remote computers',
              exact: true,
            })
            .focus();
          await page.keyboard.press('Tab');
          await expect(
            page.getByRole('combobox', {
              name: 'Computer status',
              exact: true,
            }),
          ).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(row).toBeFocused();
          await page.keyboard.press('Enter');
        }
        await expect(page).toHaveURL(
          new RegExp(`/settings/remotes/${inventory.environmentId}$`),
        );
        await page.keyboard.press('Escape');
        await expect(page).toHaveURL(/\/settings\/remotes$/);
        await expect(row).toBeFocused();
        await row.click();
        await expect(
          page.getByRole('main', { name: 'Settings', exact: true }),
        ).toBeFocused();
        await expect(
          page
            .getByRole('group', { name: 'Overview', exact: true })
            .getByText(status === 'online' ? 'Online' : 'Offline', {
              exact: true,
            }),
        ).toBeVisible();
      } finally {
        await restore?.();
      }
    });
  }
}
