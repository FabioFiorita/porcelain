import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';
import { playgroundManifest } from './playground';

test('persists explicit commit models and pull strategy in both themes', async ({
  page,
}, testInfo) => {
  const manifest = playgroundManifest();
  const { tokenFile } = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  await page.route('**/api/git/commit-models', (route) =>
    route.fulfill({
      json: [
        { id: 'codex:gpt-6-astra', label: 'Astra' },
        { id: 'codex:gpt-5.6-luna', label: 'Luna' },
        { id: 'claude:sonnet', label: 'Sonnet' },
        { id: 'claude:haiku', label: 'Haiku' },
      ],
    }),
  );
  await page.goto('/');
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  const model = dialog.getByLabel('Commit model', { exact: true });
  await expect(model).toHaveValue('codex:gpt-5.6-luna');
  await expect(
    model.getByRole('option', { name: /automatic|default/i }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('tab', { name: 'Merge', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('tab', { name: 'Rebase', exact: true }).click();
  await model.selectOption('claude:haiku');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await model.scrollIntoViewIfNeeded();
    await expect(model).toBeInViewport();
    const width = await dialog.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client);
    await page.screenshot({
      path: testInfo.outputPath(`settings-${theme}.png`),
      animations: 'disabled',
    });
  }
  await page.reload();
  await openNavigation(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(model).toHaveValue('claude:haiku');
  await expect(
    dialog.getByRole('tab', { name: 'Rebase', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
});
