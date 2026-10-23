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

export async function seedPreferences(
  page: Page,
  preferences: Record<string, unknown>,
) {
  await page.evaluate((value) => {
    localStorage.setItem(
      'porcelain.prototype.preferences',
      JSON.stringify(value),
    );
  }, preferences);
}

export async function savedPreferences(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const saved: unknown = JSON.parse(
      localStorage.getItem('porcelain.prototype.preferences') ?? '{}',
    );
    return saved;
  });
}
