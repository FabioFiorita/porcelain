import { expect, test } from '@playwright/test';

test('automatically authenticates on page load and keeps Devtools', async ({
  page,
}) => {
  // Pairing ends by reading the session, which is the first request the new
  // device makes on its own.
  const session = page.waitForRequest('**/api/session');
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'Projects and worktrees' }),
  ).toBeVisible();
  // The browser authenticates with its device cookie and nothing else; a page
  // that could attach a credential is a page that could leak one.
  expect((await session).headers().authorization).toBeUndefined();
  await page.getByRole('button', { name: /open.*devtools/i }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Playground tools' })
      .getByRole('button', { name: 'Paired', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /close.*devtools/i }).click();
  await page.keyboard.press('Alt+Shift+D');
  await page.keyboard.press('Alt+Shift+D');
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    ),
  ).toBe(true);
  for (const name of ['Disconnect', 'Exit', 'Reload', 'Refresh']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  }
  await page.reload();
  await expect(
    page.getByRole('navigation', { name: 'Projects and worktrees' }),
  ).toBeVisible();
});

test('a failed automatic connection can be retried from Devtools', async ({
  page,
}) => {
  await page.route('**/__porcelain/playground', (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(
    'Automatic playground connection failed',
  );
  await page.unroute('**/__porcelain/playground');
  await page.getByRole('button', { name: /open.*devtools/i }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await page.getByRole('button', { name: 'Pair this browser' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Projects and worktrees' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});
