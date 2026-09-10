import { expect, test } from '@playwright/test';

test('a visitor can understand availability, explore docs, and read the privacy draft', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'A considered review',
  );
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Download', exact: true })
    .click();
  await expect(
    page.getByText('No download available yet', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Explore the development preview' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Development preview',
  );
  await expect(
    page.getByText('pnpm dev:playground', { exact: true }),
  ).toBeVisible();
  await page.goto('/docs');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Meet Porcelain',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://porcelain.example/og/docs/image.png',
  );
  await page.getByRole('link', { name: 'Current status' }).last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Current status',
  );
  await page.goto('/privacy');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Draft — factual confirmation required',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('documentation search takes the reader to a matching page', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Explore Porcelain', exact: true })
    .click();
  await page
    .getByRole('button', { name: /search/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('textbox', { name: 'Search', exact: true })
    .fill('worktrees');
  await dialog
    .getByRole('button', { name: 'Projects and worktrees', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/docs\//);
});

test('generated documentation exports and social previews remain usable', async ({
  request,
}) => {
  const index = await request.get('/llms.txt');
  expect(index.ok()).toBe(true);
  expect(await index.text()).toContain('Meet Porcelain');
  const full = await request.get('/llms-full.txt');
  expect(await full.text()).toContain('Projects and worktrees');
  const markdown = await request.get('/docs/review-workspace', {
    headers: { Accept: 'text/markdown' },
  });
  expect(markdown.headers()['content-type']).toContain('text/markdown');
  expect(await markdown.text()).toContain('The review workspace');
  const suffix = await request.get('/docs/status.md');
  expect(suffix.headers()['content-type']).toContain('text/markdown');
  const image = await request.get('/og/docs/image.png');
  expect(image.ok()).toBe(true);
  expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).byteLength).toBeGreaterThan(1000);
  const missing = await request.get('/docs/does-not-exist');
  expect(missing.status()).toBe(404);
});

test('landing navigation remains keyboard accessible without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
