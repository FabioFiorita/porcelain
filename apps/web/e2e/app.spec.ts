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
  const surface = page.getByRole('main').locator('..');
  const light = await surface.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const dark = () =>
    page.evaluate(() => document.documentElement.classList.contains('dark'));
  // The appearance cycle is system -> light -> dark; the test browser reports a
  // light system preference, so the first step keeps the resolved theme.
  await page.keyboard.press('Alt+Shift+D');
  expect(await dark()).toBe(false);
  await page.keyboard.press('Alt+Shift+D');
  expect(await dark()).toBe(true);
  await expect
    .poll(() =>
      surface.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(light);
  await page.keyboard.press('Alt+Shift+D');
  expect(await dark()).toBe(false);
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

test('serves the built preview without playground tooling', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('No environment connected')).toBeVisible();
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
