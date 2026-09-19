import { expect, type Page } from '@playwright/test';

export async function openNavigation(page: Page) {
  // A closing drawer remains visible during its exit transition.
  await expect(page.locator('[role="dialog"][data-ending-style]')).toHaveCount(
    0,
  );
  const navigation = page.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  if (await navigation.isVisible()) return;
  // The trigger owns the navigator's state, and the panel can still be absent
  // while the workspace loads, so an expanded trigger means it is on its way.
  const trigger = page.getByRole('button', {
    name: 'Toggle Sidebar',
    exact: true,
  });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true')
    await trigger.click();
  await expect(navigation).toBeVisible();
}
