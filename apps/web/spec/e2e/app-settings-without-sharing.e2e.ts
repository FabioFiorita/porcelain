import { expect, test } from './fixtures.ts';
import { openThisComputer } from '../kit/settings.ts';

test('browser Settings uses the same three sections and exposes host-gated Devices and computer details', async ({
  pairedPage,
  server,
  app,
}) => {
  const host = (await server.inventory()).environment.name;
  const offered = await server.serviceUpdate();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const navigator = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  await expect(navigator.getByText('Porcelain', { exact: true })).toBeVisible();
  await expect(
    navigator.getByRole('button', { name: `Computer: ${host}`, exact: true }),
  ).toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  const sections = settings.getByRole('navigation', {
    name: 'Settings sections',
    exact: true,
  });
  await expect(sections.getByRole('button')).toHaveText([
    'General',
    'Reviews & Git',
    'Computers',
  ]);
  await expect(
    settings.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await openThisComputer(pairedPage);
  await expect(
    settings.getByText(`Porcelain ${offered.version ?? ''}`, { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', {
      name: 'Disconnect this browser',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    settings.getByRole('list', {
      name: 'Paired devices and links',
      exact: true,
    }),
  ).toBeVisible();
  await app.follow('/settings/computers/a-saved-computer');
  await expect(
    settings.getByText(
      'This computer is no longer saved on this app. Return to Computers to add it again.',
      { exact: true },
    ),
  ).toBeVisible();
});
