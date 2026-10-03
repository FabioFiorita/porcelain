import { expect, test } from './fixtures.ts';

test('the Settings menu opens Settings, which shows the app version and that the local build updates by reinstalling', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();

  await app.clickMenu('open-settings');
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  await settings
    .getByRole('button', { name: 'This computer', exact: true })
    .click();
  const version = await app.electron.evaluate(({ app }) => app.getVersion());
  await expect(
    settings.getByText(`Porcelain app ${version}`, { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText(
      'This build updates by reinstalling; there is no update feed yet.',
      { exact: true },
    ),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(settings).toBeHidden();
  expect(app.errors).toEqual([]);
});

test('without a Vite server the menus offer full screen and zoom but no Reload or Developer Tools item', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  await app.window();
  const menus = await app.menuRoles();
  const roles = menus.flat();
  expect(menus[3]).toEqual([
    'resetzoom',
    'zoomin',
    'zoomout',
    '',
    'togglefullscreen',
  ]);
  expect(roles).not.toContain('reload');
  expect(roles).not.toContain('forcereload');
  expect(roles).not.toContain('toggledevtools');
});
