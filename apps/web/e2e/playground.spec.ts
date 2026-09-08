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
    page.getByRole('button', { name: /main · main worktree/ }),
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
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByLabel('Access token')).toHaveValue('');
  await page.getByLabel('Access token').fill('wrong-token');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'rejected',
  );
});

for (const delayed of ['playground', 'manual'] as const) {
  test(`disconnect discards a delayed ${delayed} login after the other login succeeds`, async ({
    page,
  }) => {
    await page.goto('/');
    const credentials = await page.request.post('/__porcelain/playground', {
      headers: {
        origin: 'http://127.0.0.1:4174',
        'x-porcelain-playground': '1',
      },
    });
    const { token } = (await credentials.json()) as { token: string };
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    await page.route('**/api/inventory', async (route) => {
      if (first) {
        first = false;
        const response = await route.fetch();
        await pending;
        await route.fulfill({ response }).catch(() => {});
      } else {
        await route.continue();
      }
    });
    const openTools = async () => {
      await page.getByRole('button', { name: /open.*devtools/i }).click();
      await page
        .getByRole('button', { name: 'Playground', exact: true })
        .click();
    };
    const manualLogin = async () => {
      await page.getByLabel('Access token').fill(token);
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
    };
    const started = page.waitForRequest('**/api/inventory');
    if (delayed === 'playground') {
      await openTools();
      await page.getByRole('button', { name: 'Connect to playground' }).click();
    } else {
      await manualLogin();
    }
    const oldRequest = await started;
    if (delayed === 'playground') {
      await page.getByRole('button', { name: /close.*devtools/i }).click();
      await manualLogin();
    } else {
      await openTools();
      await page.getByRole('button', { name: 'Connect to playground' }).click();
      await page.getByRole('button', { name: /close.*devtools/i }).click();
    }
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    release();
    const oldResponse = await oldRequest.response();
    await oldResponse?.finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    await expect(page.getByLabel('Access token')).toHaveValue('');
    await expect(
      page.getByRole('navigation', { name: 'Projects and worktrees' }),
    ).toHaveCount(0);
  });
}
