import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { playgroundManifest } from './playground';
import { openNavigation } from './workspace-navigation';

test('posts a line comment on the exact comparison, reloads it, and reveals it from the sidebar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/');
  const manifest = playgroundManifest();
  const { tokenFile } = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: /^accessibility.md/ }).click();
  await expect(
    page.getByRole('heading', { name: 'accessibility.md', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('diff-header.png') });
  await page.locator('[data-column-number]').first().hover();
  await page.locator('[data-utility-button]').first().click();
  const body = `Please clarify this line ${test.info().project.name}`;
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(body);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/comments'),
  );
  await page
    .locator('form')
    .filter({
      has: page.getByRole('textbox', { name: 'Comment', exact: true }),
    })
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        anchor: expect.objectContaining({
          filePath: 'docs/accessibility.md',
          kind: 'codeRange',
          startLine: 1,
          endLine: 1,
          side: 'additions',
          comparison: { kind: 'worktree', scope: 'staged' },
          contentFingerprint: expect.any(String),
        }),
      }),
    ]),
  );
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Comments/ }).click();
  const thread = page
    .getByRole('article', { name: 'Comment thread' })
    .filter({ hasText: body });
  // The sidebar cards have a reveal action; the inline copy does not.
  await thread.getByTitle('Show in the code').click();
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('c');
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toBeFocused();
  await page.keyboard.type('jkr');
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveValue('jkr');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: /board-preview.png/ }).click();
  await page
    .getByRole('button', {
      name: /Comment on .*board-preview.png/,
      exact: true,
    })
    .click();
  await page
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Binary file discussion');
  await page
    .locator('form')
    .filter({
      has: page.getByRole('textbox', { name: 'Comment', exact: true }),
    })
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Comment', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Binary file discussion', { exact: true }),
  ).toBeVisible();
});
