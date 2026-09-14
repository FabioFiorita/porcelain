import { expect, test } from '@playwright/test';

test('uses playground Devtools to inspect credentials and connect through normal authentication', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.getByText('No environment connected')).toBeVisible();
  await page.getByRole('button', { name: /open.*devtools/i }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Playground tools' });
  await panel.getByRole('button', { name: 'Reveal token' }).click();
  await expect(panel.getByLabel('Playground token')).not.toHaveValue('');
  await expect(panel.getByLabel('Token file')).toHaveValue(/token\.txt$/);
  const token = await panel.getByLabel('Playground token').inputValue();
  const tokenFile = await panel.getByLabel('Token file').inputValue();
  expect((await page.request.get(`/@fs${tokenFile}`)).status()).toBe(403);
  await panel.getByRole('button', { name: 'Hide token' }).click();
  await expect(panel.getByLabel('Playground token')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Copy token' }).click();
  await expect(panel.getByText('Token copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(token);
  const inventoryRequest = page.waitForRequest('**/api/inventory');
  await panel.getByRole('button', { name: 'Connect to playground' }).click();
  expect((await inventoryRequest).headers().authorization).toBe(
    `Bearer ${token}`,
  );
  await expect(
    page.getByRole('button', { name: /main.*Main worktree/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (secret) =>
        JSON.stringify([localStorage, sessionStorage, location.href]).includes(
          secret,
        ),
      token,
    ),
  ).toBe(false);
  await page.getByRole('button', { name: /close.*devtools/i }).click();
  for (const name of ['Disconnect', 'Exit', 'Reload', 'Refresh']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  }
});
