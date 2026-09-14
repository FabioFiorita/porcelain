import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

test('commits the selected new file and leaves other staged changes in place', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  const manifest = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing isolated playground');
  const { tokenFile, worktreePath } = JSON.parse(
    await readFile(manifest, 'utf8'),
  ) as { tokenFile: string; worktreePath: string };
  const git = async (...args: string[]) =>
    (await promisify(execFile)('git', ['-C', worktreePath, ...args])).stdout;
  const staged = await git('diff', '--cached', '--name-only');
  await page.goto('/');
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const checkbox of await dialog.getByRole('checkbox').all())
    await checkbox.uncheck();
  await dialog.getByLabel('notes.txt', { exact: true }).check();
  await dialog.getByLabel('Message').fill('Commit selected review notes');
  await dialog
    .getByRole('button', { name: 'Commit selected files', exact: true })
    .click();
  await expect(dialog.getByRole('status')).toHaveText('succeeded');
  expect(await git('show', '--format=', '--name-only', 'HEAD')).toBe(
    'notes.txt\n',
  );
  expect(await git('diff', '--cached', '--name-only')).toBe(staged);
});
