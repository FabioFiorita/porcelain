import { expect, test } from './fixtures.ts';

test('web Settings hides the native app update check', async ({
  pairedPage,
}) => {
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
  await settings.getByRole('button', { name: 'Updates', exact: true }).click();
  await expect(
    settings.getByRole('heading', { name: 'Updates', exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', { name: 'Check for updates', exact: true }),
  ).not.toBeAttached();
});
