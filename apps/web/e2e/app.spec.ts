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
  await expect(page.getByText('This browser is not paired')).toBeVisible();
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
  await expect(page.getByText('This browser is not paired')).toBeVisible();
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

test('tells the owner to pair against the address they actually reached', async ({
  page,
  baseURL,
}) => {
  await page.goto('/');
  // A hardcoded example is wrong for anyone on another port, a LAN address or
  // a Tailscale name. The origin in the address bar is one the server answers
  // at by construction, so pairing cannot refuse it.
  await expect(page.getByRole('main')).toContainText(`--address ${baseURL}`);
});

test('renders the pairing screens inside the themed page, like every other route', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  // A bad link is the first thing a new owner sees; it must not be the one
  // screen without the heading, the gutter or their appearance.
  await page.goto('/pair#c=pcp_not-a-real-code&e=not-this-installation');
  await expect(
    page.getByRole('heading', { name: 'Porcelain', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.querySelector('.dark') === null ? 'light' : 'dark',
      ),
    )
    .toBe('dark');
});

test('erases a pairing code from history, so navigation cannot replay it', async ({
  page,
}) => {
  // Not a real code: this is about what the address bar keeps, and a preview
  // build has no server to redeem against anyway.
  await page.goto('/pair#c=pcp_fixture-code&e=fixture-environment');
  await expect(page).toHaveURL(/\/pair$/);
  expect(page.url()).not.toContain('pcp_fixture-code');
  await page.goBack();
  expect(page.url()).not.toContain('pcp_fixture-code');
  await page.goForward();
  expect(page.url()).not.toContain('pcp_fixture-code');
  await page.reload();
  expect(page.url()).not.toContain('pcp_fixture-code');
});
