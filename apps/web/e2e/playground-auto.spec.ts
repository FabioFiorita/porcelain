import { expect, test } from '@playwright/test';

test('automatically authenticates on page load, keeps Devtools, and respects disconnect', async ({
  page,
}) => {
  const inventory = page.waitForRequest('**/api/inventory');
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'Projects and worktrees' }),
  ).toBeVisible();
  expect((await inventory).headers().authorization).toMatch(/^Bearer .+/);
  await page.getByRole('button', { name: /open.*devtools/i }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Playground tools' })
      .getByRole('button', { name: 'Connected', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /close.*devtools/i }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.getByLabel('Access token')).toHaveValue('');
  await expect(
    page.getByRole('navigation', { name: 'Projects and worktrees' }),
  ).toHaveCount(0);
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
  await expect(page.getByLabel('Access token')).toHaveValue('');
  await page.unroute('**/__porcelain/playground');
  await page.getByRole('button', { name: /open.*devtools/i }).click();
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await page.getByRole('button', { name: 'Connect to playground' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Projects and worktrees' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('a delayed automatic login cannot undo a later manual login and disconnect', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delayed = false;
  await page.route('**/api/inventory', async (route) => {
    if (!delayed) {
      delayed = true;
      const response = await route.fetch();
      await pending;
      await route.fulfill({ response }).catch(() => {});
    } else {
      await route.continue();
    }
  });
  const started = page.waitForRequest('**/api/inventory');
  await page.goto('/');
  const oldRequest = await started;
  const credentials = await page.request.post('/__porcelain/playground', {
    headers: { origin: 'http://127.0.0.1:4175', 'x-porcelain-playground': '1' },
  });
  const { token } = (await credentials.json()) as { token: string };
  await page.getByLabel('Access token').fill(token);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
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

test('a slow automatic connector module cannot reconnect after manual disconnect', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/src/playground-auto-connect.tsx*', async (route) => {
    const response = await route.fetch();
    await pending;
    await route.fulfill({ response });
  });
  const started = page.waitForRequest('**/src/playground-auto-connect.tsx*');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const moduleRequest = await started;
  const credentials = await page.request.post('/__porcelain/playground', {
    headers: { origin: 'http://127.0.0.1:4175', 'x-porcelain-playground': '1' },
  });
  const { token } = (await credentials.json()) as { token: string };
  await page.getByLabel('Access token').fill(token);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  const loginRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/(api\/inventory|__porcelain\/playground)$/.test(request.url()))
      loginRequests.push(request.url());
  });
  release();
  await (await moduleRequest.response())?.finished();
  // Let the delayed module execute and any resulting login requests settle.
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Access token')).toHaveValue('');
  expect(loginRequests).toEqual([]);
});
