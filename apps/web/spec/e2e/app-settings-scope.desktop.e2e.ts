import { expect, test } from './fixtures.ts';

test('desktop Settings opens on This computer, lists This computer, Ways in, Remote computers, Devices, Git and agents and Appearance with no Connection, and shows each as its own page', async ({
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
  const sections = settings.getByRole('navigation', {
    name: 'Settings sections',
    exact: true,
  });
  await expect(sections.getByRole('button')).toHaveText([
    'This computer',
    'Ways in',
    'Remote computers',
    'Devices',
    'Git and agents',
    'Appearance',
    'Back',
  ]);
  await expect(
    settings.getByRole('heading', { name: 'This computer', exact: true }),
  ).toBeVisible();

  await sections.getByRole('button', { name: 'Ways in', exact: true }).click();
  await expect(
    settings.getByRole('heading', { name: 'Ways in', exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('switch', { name: 'Local network', exact: true }),
  ).toBeVisible();
  await sections.getByRole('button', { name: 'Devices', exact: true }).click();
  await expect(
    settings.getByRole('switch', { name: 'Local network', exact: true }),
  ).not.toBeAttached();
  await expect(
    settings.getByText('Paired devices', { exact: true }),
  ).toBeVisible();
  await sections
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
  await expect(
    settings.getByText('No remote computers yet', { exact: true }),
  ).toBeVisible();
});
