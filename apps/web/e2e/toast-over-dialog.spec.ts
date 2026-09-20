import { expect, test } from '@playwright/test';
import { pairBrowser } from './playground';
import { openNavigation } from './workspace-navigation';

test('shows a toast above the dialog that raised it', async ({ page }) => {
  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog
    .getByRole('button', { name: 'Copy MCP configuration', exact: true })
    .click();

  // Copied or not, the toast answers the click, so it must not sit under the backdrop.
  const toast = page.locator('[data-slot="toast"]').first();
  // It slides in from below the window; measure once it has arrived.
  await expect(toast).toBeInViewport({ ratio: 1 });
  const box = await toast.boundingBox();
  if (!box) throw new Error('The toast has no box');
  const topmost = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('[data-slot="toast"]') != null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(topmost).toBe(true);
  await expect(dialog).toBeVisible();
});
