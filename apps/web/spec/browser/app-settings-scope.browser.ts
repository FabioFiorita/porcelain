import { expect } from 'vitest';
import { test } from '../kit/journey';

test('desktop Settings splits sharing into This computer, Ways in, Devices and Remote computers, each its own page', async ({
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
  await sections.getByRole('button', { name: 'Ways in', exact: true }).click();
  await expect
    .element(settings.getByRole('heading', { name: 'Ways in', exact: true }))
    .toBeVisible();
  await expect
    .element(
      settings.getByRole('switch', { name: 'Local network', exact: true }),
    )
    .toBeVisible();
  await sections.getByRole('button', { name: 'Devices', exact: true }).click();
  await expect
    .element(
      settings.getByRole('switch', { name: 'Local network', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(settings.getByText('Paired devices', { exact: true }))
    .toBeVisible();
  await sections
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
  await expect
    .element(settings.getByText('No remote computers yet', { exact: true }))
    .toBeVisible();
});
