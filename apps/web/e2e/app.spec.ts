import { expect, test } from '@playwright/test';

test('opens the built workspace and switches the preset theme with the keyboard', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Porcelain');
  await expect(
    page.getByRole('heading', { name: 'Porcelain', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('No environment connected')).toBeVisible();
  const surface = page.locator('#root > div');
  const light = await surface.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Switch to light theme' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      surface.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(light);
  await page.keyboard.press('Enter');
  await expect(toggle).toBeVisible();
  await expect
    .poll(() =>
      surface.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe(light);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('toggles the theme with the registered shortcut', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Alt+Shift+d');
  await expect(
    page.getByRole('button', { name: 'Switch to light theme' }),
  ).toBeVisible();
  await page.keyboard.press('Alt+Shift+d');
  await expect(
    page.getByRole('button', { name: 'Switch to dark theme' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /open.*devtools/i }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.post('/__porcelain/playground', {
        headers: {
          origin: 'http://127.0.0.1:4173',
          'x-porcelain-playground': '1',
        },
      })
    ).status(),
  ).toBe(404);
});
