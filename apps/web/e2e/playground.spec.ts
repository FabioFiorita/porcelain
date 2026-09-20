import { expect, test } from '@playwright/test';

test('pairs through playground Devtools without revealing anything reusable', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('This browser is not paired')).toBeVisible();
  await page.getByRole('button', { name: /open.*devtools/i }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Playground tools' });
  // There is nothing to reveal or copy: a grant is spent when it is used.
  for (const name of ['Reveal token', 'Copy token']) {
    await expect(panel.getByRole('button', { name })).toHaveCount(0);
  }
  const redeemed = page.waitForResponse('**/api/pair');
  await panel.getByRole('button', { name: 'Pair this browser' }).click();
  expect((await redeemed).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: /main.*Main worktree/ }),
  ).toBeVisible();
  const cookie = (await page.context().cookies()).find(
    (entry) => entry.name === 'porcelain_device',
  );
  expect(cookie?.httpOnly).toBe(true);
  // Nothing the page can read holds the credential, and the pairing code is
  // gone from the address bar.
  expect(
    await page.evaluate(
      (secret) =>
        JSON.stringify([localStorage, sessionStorage, location.href]).includes(
          secret ?? '',
        ),
      cookie?.value,
    ),
  ).toBe(false);
  await page.getByRole('button', { name: /close.*devtools/i }).click();
  for (const name of ['Disconnect', 'Exit', 'Reload', 'Refresh']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  }
});
