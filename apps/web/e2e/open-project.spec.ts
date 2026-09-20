import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { playgroundManifest } from './playground';
import { openNavigation } from './workspace-navigation';

test('finds and browses real server repositories in both themes', async ({
  page,
}, testInfo) => {
  const manifest = playgroundManifest();
  const { tokenFile } = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  const root = dirname(tokenFile);
  const group = `code-${testInfo.project.name}`;
  const first = `found-${testInfo.project.name}`;
  const second = `browse-${testInfo.project.name}`;
  for (const name of [first, second]) {
    const path = join(root, group, name);
    await mkdir(path, { recursive: true });
    execFileSync('git', ['init', '-b', 'main', path], {
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    });
  }
  await page.goto('/');
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Open project', exact: true });
  const search = dialog.getByRole('textbox', {
    name: 'Search repositories on this machine',
  });
  await search.fill(first);
  const discovery = dialog.getByRole('region', {
    name: 'Found on this machine',
  });
  await expect(
    discovery.getByRole('button', { name: new RegExp(first) }),
  ).toBeVisible();
  await discovery.getByRole('button', { name: new RegExp(first) }).click();
  await expect(dialog).toHaveCount(0);
  await openNavigation(page);
  await expect(
    page.getByRole('button', { name: new RegExp(`main.*${first}`) }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Open project', exact: true });
  await dialog.getByRole('button', { name: group, exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: `Open ${group}`, exact: true }),
  ).toBeDisabled();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator('html')).toHaveClass(
      theme === 'dark' ? /dark/ : /^(?!.*dark).*$/,
    );
    await expect(dialog).toBeInViewport();
    await dialog
      .getByRole('button', { name: 'Enter a path' })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole('button', { name: 'Enter a path' }),
    ).toBeInViewport();
    await page.waitForTimeout(250);
    const resultViewport = dialog
      .getByRole('region', { name: 'Found on this machine' })
      .locator('[data-slot="scroll-area-viewport"]');
    expect(
      await resultViewport.evaluate((element) => element.clientHeight),
    ).toBeLessThanOrEqual(112);
    await page.screenshot({ path: testInfo.outputPath(`${theme}.png`) });
  }
  await dialog
    .getByLabel('Folders', { exact: true })
    .getByRole('button', { name: second, exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: `Open ${second}`, exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Up', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: `Open ${group}`, exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel('Folders', { exact: true })
    .getByRole('button', { name: second, exact: true })
    .click();
  await dialog
    .getByRole('button', { name: `Open ${second}`, exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await openNavigation(page);
  await expect(
    page.getByRole('button', { name: new RegExp(`main.*${second}`) }),
  ).toHaveAttribute('aria-current', 'page');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
