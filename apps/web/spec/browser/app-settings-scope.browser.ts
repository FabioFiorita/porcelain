import { expect } from 'vitest';
import { test } from '../kit/journey';

test('desktop Settings lists Sharing as its own section and opens its page', async ({
  pairedPage,
}) => {
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
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
  await sections.getByRole('button', { name: 'Sharing', exact: true }).click();
  await expect
    .element(settings.getByRole('heading', { name: 'Sharing', exact: true }))
    .toBeVisible();
  await expect
    .element(
      settings.getByRole('switch', { name: 'Local network', exact: true }),
    )
    .toBeVisible();
});
