import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

test('keeps merge recovery after reload, finishes the merge, and amends only its message', async ({
  page,
}, info) => {
  const { projectPath } = await playgroundInfo<{ projectPath: string }>();
  const path = join(dirname(projectPath), `recovery-${info.project.name}`);
  await mkdir(path);
  const git = async (...args: string[]) =>
    (
      await promisify(execFile)('git', ['-C', path, ...args], {
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
        },
      })
    ).stdout.trim();
  await git('init', '-b', 'main');
  await git('config', 'user.name', 'Browser fixture');
  await git('config', 'user.email', 'browser@example.test');
  await writeFile(join(path, 'file.txt'), 'base\n');
  await git('add', '.');
  await git('commit', '-m', 'Base');
  await git('switch', '-c', 'side');
  await writeFile(join(path, 'file.txt'), 'side\n');
  await git('commit', '-am', 'Side');
  await git('switch', 'main');
  await writeFile(join(path, 'file.txt'), 'main\n');
  await git('commit', '-am', 'Main');
  await expect(git('merge', 'side')).rejects.toThrow();
  await pairBrowser(page);
  const response = await page.request.post('/api/projects', { data: { path } });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.reload();
  await openNavigation(page);
  await page
    .getByRole('button', { name: new RegExp(`main.*${project.name}`) })
    .click();
  const guidance = page.getByRole('region', { name: 'Merge recovery' });
  await expect(guidance).toContainText('waiting for conflict resolution');
  await page.reload();
  await expect(guidance).toContainText('waiting for conflict resolution');
  await writeFile(join(path, 'file.txt'), 'resolved\n');
  await git('add', 'file.txt');
  await page.reload();
  await expect(guidance).toContainText('ready to finish');
  await page.getByRole('button', { name: 'Git actions', exact: true }).click();
  await page.getByRole('menuitem', { name: /Commit selected files/ }).click();
  let dialog = page.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  await expect(dialog).toContainText('commits every staged resolution');
  await dialog.getByLabel('Message').fill('Finish reviewed merge');
  await dialog
    .getByRole('button', { name: 'Commit selected files', exact: true })
    .click();
  await expect(dialog.getByRole('status')).toContainText('succeeded');
  expect((await git('show', '-s', '--format=%P')).split(' ')).toHaveLength(2);
  await expect(guidance).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await writeFile(join(path, 'later.txt'), 'Keep this staged for later.\n');
  await git('add', 'later.txt');
  const staged = await git('diff', '--cached', '--binary');
  const tree = await git('rev-parse', 'HEAD^{tree}');
  await page.reload();
  await page.getByRole('button', { name: 'Git actions', exact: true }).click();
  await page.getByRole('menuitem', { name: /Amend last commit/ }).click();
  dialog = page.getByRole('dialog', { name: 'Amend last commit', exact: true });
  await expect(dialog.getByLabel('Message')).toHaveValue(
    'Finish reviewed merge',
  );
  await dialog.getByRole('checkbox').uncheck();
  await dialog.getByLabel('Message').fill('Corrected merge message');
  await dialog
    .getByRole('button', { name: 'Amend last commit', exact: true })
    .click();
  await expect(dialog.getByRole('status')).toContainText('succeeded');
  expect(await git('show', '-s', '--format=%s')).toBe(
    'Corrected merge message',
  );
  expect(await git('rev-parse', 'HEAD^{tree}')).toBe(tree);
  expect(await git('diff', '--cached', '--binary')).toBe(staged);
  expect((await page.request.delete(`/api/projects/${project.id}`)).ok()).toBe(
    true,
  );
});
