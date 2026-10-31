import { closeSettings, openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('the owner names this computer in Settings, tab titles and accessible project identity', async ({
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
});
