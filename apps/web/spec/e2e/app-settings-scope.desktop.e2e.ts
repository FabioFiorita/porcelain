import { expect, test } from './fixtures.ts';
import { openThisComputer } from '../kit/settings.ts';

test('desktop Settings uses the shared three sections and nests this computer and Ways in under Computers', async ({
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
    'General',
    'Reviews & Git',
    'Computers',
  ]);
  await expect(
    settings.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await openThisComputer(pairedPage);
  await expect(pairedPage).toHaveURL(/\/settings\/computers\/this-computer$/);
  await expect(
    settings
      .getByRole('navigation', { name: 'breadcrumb', exact: true })
      .getByText('This computer', { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('switch', { name: 'Local network', exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('textbox', {
      name: 'Name of this computer',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', {
      name: 'Disconnect this browser',
      exact: true,
    }),
  ).not.toBeAttached();
  await expect(
    settings.getByText('Paired devices', { exact: true }),
  ).toBeVisible();
  await sections
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await expect(
    settings
      .getByRole('list', { name: 'Computers', exact: true })
      .getByRole('listitem'),
  ).toHaveCount(1);
  await expect(
    settings.getByRole('button', { name: 'Open This computer', exact: true }),
  ).toBeVisible();
  await openThisComputer(pairedPage);
  await expect(
    settings.getByText('Porcelain MCP server', { exact: true }),
  ).toBeVisible();
});
