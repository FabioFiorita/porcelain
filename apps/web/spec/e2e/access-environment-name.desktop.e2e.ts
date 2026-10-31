import { closeSettings, openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('the owner names this computer and picks its icon in Settings, tab titles and accessible project identity', async ({
  pairedPage,
  app,
  server,
}) => {
  const host = (await server.inventory()).environment.name;
  const project = (await server.project()).name;
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const navigator = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  await expect(navigator.getByText('Porcelain', { exact: true })).toBeVisible();
  await expect(
    navigator.getByRole('img', { name: `Computer: ${host}`, exact: true }),
  ).not.toBeAttached();
  await expect(
    navigator.getByRole('button', {
      name: `Project actions: ${project} · ${host}`,
      exact: true,
    }),
  ).toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await openThisComputer(pairedPage);
  const rename = settings.getByRole('button', { name: 'Rename', exact: true });
  await rename.click();
  const name = settings.getByRole('textbox', {
    name: 'Name of this computer',
    exact: true,
  });
  const save = settings.getByRole('button', { name: 'Save', exact: true });
  await expect(name).toHaveValue('');
  await expect(save).toBeDisabled();
  await name.fill('Workstation');
  await save.click();
  await expect
    .poll(async () => (await server.inventory()).environment)
    .toEqual({ name: 'Workstation', custom: true });
  await expect(name).not.toBeAttached();
  await expect(
    settings.getByRole('heading', {
      name: 'Computers. Workstation',
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => app.title()).toBe('Settings · Workstation');
  await closeSettings(settings.page());
  await closeSettings(settings.page());
  await expect
    .poll(() => app.title())
    .toBe(`Changes — ${project} · Workstation`);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(navigator.getByText('Porcelain', { exact: true })).toBeVisible();
  await expect(
    navigator.getByRole('img', {
      name: 'Computer: Workstation',
      exact: true,
    }),
  ).not.toBeAttached();
  await expect(
    navigator.getByRole('button', {
      name: `Project actions: ${project} · Workstation`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    navigator.getByRole('button', {
      name: `Project actions: ${project} · ${host}`,
      exact: true,
    }),
  ).not.toBeAttached();
  await expect(
    navigator.getByRole('img', { name: `Computer: ${host}`, exact: true }),
  ).not.toBeAttached();
  await navigator
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await openThisComputer(pairedPage);

  await rename.click();
  await expect(name).toHaveValue('Workstation');
  await name.fill('');
  await save.click();
  await expect
    .poll(async () => (await server.inventory()).environment)
    .toEqual({ name: host, custom: false });
  await expect.poll(() => app.title()).toBe('Settings');
  await closeSettings(settings.page());
  await closeSettings(settings.page());
  await expect.poll(() => app.title()).toBe(`Changes — ${project}`);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    navigator.getByRole('button', {
      name: `Project actions: ${project} · ${host}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    navigator.getByRole('button', {
      name: `Project actions: ${project} · Workstation`,
      exact: true,
    }),
  ).not.toBeAttached();

  await navigator
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await openThisComputer(pairedPage);
  await settings
    .getByRole('button', { name: 'Icon: Desktop', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitemradio', { name: 'Laptop', exact: true })
    .click();
  await expect
    .poll(async () => (await server.inventory()).environment)
    .toEqual({ name: host, custom: false, icon: 'laptop' });
  const laptop = settings.getByRole('button', {
    name: 'Icon: Laptop',
    exact: true,
  });
  await expect(laptop).toBeVisible();
  await pairedPage.keyboard.press('Escape');
  await expect(pairedPage.getByRole('menu')).not.toBeAttached();
  await expect(laptop).toBeEnabled();
  await laptop.click();
  await pairedPage
    .getByRole('menuitemradio', { name: 'Desktop', exact: true })
    .click();
  await expect
    .poll(async () => (await server.inventory()).environment)
    .toEqual({ name: host, custom: false });
  await expect(
    settings.getByRole('button', { name: 'Icon: Desktop', exact: true }),
  ).toBeVisible();
});

test('computer labels return when the worktree navigator is widened', async ({
  pairedPage: page,
  app,
  world,
  server,
}) => {
  await world.repo({ kind: 'environment-name-fixture', name: 'Desk' }, 'this');
  await world.repo({ kind: 'environment-name-fixture', name: 'Lab' }, 'remote');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(await app.remoteLink());
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    settings.getByRole('button', { name: 'Open Lab', exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  const navigator = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const project = await server.project();
  await navigator
    .getByRole('button', {
      name: `Project actions: ${project.name} · Desk`,
      exact: true,
    })
    .click();
  await page
    .getByRole('menuitem', { name: 'Rename project', exact: true })
    .click();
  const rename = page.getByRole('dialog', {
    name: 'Rename project',
    exact: true,
  });
  await rename
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Document inspection');
  await rename.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(rename).not.toBeAttached();
  const badge = navigator.getByRole('img', {
    name: 'Computer: Desk',
    exact: true,
  });
  const handle = page.getByRole('separator', {
    name: 'Worktree navigator and document panes',
    exact: true,
  });
  for (const width of [220, 420, 220, 420]) {
    const panel = await navigator.boundingBox();
    const grip = await handle.boundingBox();
    if (!panel || !grip)
      throw new Error('The worktree navigator must have a resize handle');
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      panel.x + width + grip.width / 2,
      grip.y + grip.height / 2,
    );
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await navigator.boundingBox())?.width ?? 0))
      .toBe(width);
    await expect(badge).toHaveText(width === 420 ? 'Desk' : '');
  }
});
