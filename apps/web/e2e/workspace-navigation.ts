import { expect, type Page } from '@playwright/test';

export async function openNavigation(page: Page) {
  // A closing drawer remains visible during its exit transition.
  await expect(page.locator('[role="dialog"][data-ending-style]')).toHaveCount(
    0,
  );
  const navigation = page.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  if (!(await navigation.isVisible())) {
    await page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
  }
  await expect(navigation).toBeVisible();
}
