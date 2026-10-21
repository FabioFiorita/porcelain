import { openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('leaving the workspace and settings restores the application title', async ({
  pairedPage,
}) => {
  await expect(pairedPage).toHaveTitle(/^Changes — /);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await expect(pairedPage).toHaveTitle('Settings');
  await pairedPage.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(pairedPage).toHaveTitle(/^Changes — /);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await openThisComputer(pairedPage);
  await pairedPage
    .getByRole('button', { name: 'Disconnect this browser', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await expect(pairedPage).toHaveTitle('Porcelain');
});
