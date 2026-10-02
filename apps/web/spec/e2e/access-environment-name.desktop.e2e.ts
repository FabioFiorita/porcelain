import { expect, test } from './fixtures.ts';

test('the owner names this computer in Settings, and the tab title, pairing and the navigator header show the name', async ({
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
  await expect(navigator.getByText(host, { exact: true })).toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await pairedPage
    .getByRole('main', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'This computer', exact: true })
    .click();
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
  await settings.getByRole('button', { name: 'Devices', exact: true }).click();
  await expect(
    settings.getByText(/to connect it to Workstation\./),
  ).toBeVisible();
  await settings
    .getByRole('button', { name: 'This computer', exact: true })
    .click();
  await expect(save).toBeDisabled();
  await expect.poll(() => app.title()).toBe('Settings · Workstation');
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect
    .poll(() => app.title())
    .toBe(`Changes — ${project} · Workstation`);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    navigator.getByText('Workstation', { exact: true }),
  ).toBeVisible();
  await navigator
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await settings
    .getByRole('button', { name: 'This computer', exact: true })
    .click();

  await name.fill('');
  await save.click();
  await expect
    .poll(async () => (await server.inventory()).environment)
    .toEqual({ name: host, custom: false });
  await expect.poll(() => app.title()).toBe('Settings');
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => app.title()).toBe(`Changes — ${project}`);
});
