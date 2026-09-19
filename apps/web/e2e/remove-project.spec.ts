import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';
import { playgroundManifest } from './playground';

test('removes a project through its menu while preserving repository files', async ({
  page,
  request,
}, testInfo) => {
  const manifest = playgroundManifest();
  const { tokenFile } = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  const path = join(dirname(tokenFile), `removal-${testInfo.project.name}`);
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
  const token = await readFile(tokenFile, 'utf8');
  const added = await request.post('/api/projects', {
    headers: { authorization: `Bearer ${token}` },
    data: { path },
  });
  expect(added.ok()).toBe(true);
  const project = await added.json();
  await page.goto('/');
  await page.getByLabel('Access token').fill(token);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
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
