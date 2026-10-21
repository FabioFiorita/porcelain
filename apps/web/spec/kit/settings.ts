import type { Page } from '@playwright/test';

export async function openThisComputer(page: Page) {
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('navigation', { name: 'Settings sections', exact: true })
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await settings
    .getByRole('button', { name: 'Open This computer', exact: true })
    .click();
  return settings;
}

export async function openSettingsAtFirstEntry(pairedPage: Page) {
  const page = await pairedPage.context().newPage();
  await page.goto('/settings/general');
  return page;
}
