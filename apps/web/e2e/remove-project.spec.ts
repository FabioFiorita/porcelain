import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

test('removes a project through its menu while preserving repository files', async ({
  page,
}, testInfo) => {
  const { projectPath } = await playgroundInfo<{ projectPath: string }>();
  const path = join(dirname(projectPath), `removal-${testInfo.project.name}`);
  await mkdir(path);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    });
  git('init', '-b', 'main', path);
  await writeFile(join(path, 'notes.txt'), 'Keep this local work.\n');
  const before = git('-C', path, 'status', '--porcelain=v2');
  await pairBrowser(page);
  // page.request shares this context's cookie jar, so the API call is made by
  // the device this page paired and needs no credential of its own.
  const added = await page.request.post('/api/projects', { data: { path } });
  expect(added.ok()).toBe(true);
  const project = await added.json();
  // The page loaded before this project existed; a reload picks it up.
  await page.reload();
  await openNavigation(page);
  await page
    .getByRole('button', { name: new RegExp(`main.*${project.name}`) })
    .click();
  await openNavigation(page);
  const trigger = page.getByRole('button', { name: project.name, exact: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await trigger.click({ button: 'right' });
    const remove = page.getByRole('menuitem', {
      name: 'Remove from Porcelain',
    });
    await expect(remove).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Copy path', exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(200);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-menu.png`) });
    await page.keyboard.press('Escape');
  }
  await trigger.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Remove from Porcelain' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(
    'Repository files and Git history stay on disk.',
  );
  await expect(dialog).toContainText(path);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(trigger).toBeVisible();
  await trigger.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Remove from Porcelain' }).click();
  await dialog.getByRole('button', { name: 'Remove from Porcelain' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toHaveCount(0);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('worktree'))
    .not.toBe(project.worktrees[0].id);
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeFocused();
  expect(await readFile(join(path, 'notes.txt'), 'utf8')).toBe(
    'Keep this local work.\n',
  );
  expect(git('-C', path, 'status', '--porcelain=v2')).toBe(before);
  await page.reload();
  await openNavigation(page);
  await expect(trigger).toHaveCount(0);
});
