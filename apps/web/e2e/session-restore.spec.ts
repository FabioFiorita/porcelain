import { expect, test } from '@playwright/test';
import { pairBrowser } from './playground';

test('keeps pairing instructions hidden while a valid session restores on repeated reloads', async ({
  page,
}) => {
  await pairBrowser(page);
  for (let reload = 0; reload < 2; reload += 1) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let received!: () => void;
    const responseReceived = new Promise<void>((resolve) => {
      received = resolve;
    });
    await page.route('**/api/session', async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      received();
      await gate;
      await route.fulfill({ response });
    });
    try {
      await page.reload();
      await responseReceived;
      await expect(page.getByText('This browser is not paired')).toHaveCount(0);
      await expect(
        page.getByRole('status', { name: 'Loading environment' }),
      ).toBeVisible();
    } finally {
      release();
    }
    await expect(
      page.getByRole('button', { name: 'Toggle Sidebar', exact: true }),
    ).toBeVisible();
    await page.unroute('**/api/session');
  }
});
