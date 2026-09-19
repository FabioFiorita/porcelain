import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';
import { playgroundManifest } from './playground';

test('commits the selected new file and leaves other staged changes in place', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  const manifest = playgroundManifest();
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
  const headers = {
    authorization: `Bearer ${(await readFile(tokenFile, 'utf8')).trim()}`,
  };
  const inventory = await (
    await page.request.get('/api/inventory', { headers })
  ).json();
  const worktree = inventory.projects
    .flatMap(
      (project: { worktrees: { id: string; path: string }[] }) =>
        project.worktrees,
    )
    .find((entry: { path: string }) => entry.path === worktreePath);
  const layerUrl = `/api/worktrees/${worktree.id}/review-layers`;
  const source = await (await page.request.get(layerUrl, { headers })).json();
  const layers = source.layers.map((layer: { files: { path: string }[] }) => ({
    ...layer,
    files: layer.files.filter((file) => file.path !== 'notes.txt'),
  }));
  const response = await page.request.put(layerUrl, {
    headers,
    data: {
      expectedRevision: source.revision,
      layers: [
        ...layers,
        {
          id: randomUUID(),
          title: 'Preserve review explanation',
          summary: 'Why these notes matter',
          files: [
            {
              path: 'notes.txt',
              scope: 'unstaged',
              note: 'This explanation must remain in History.',
            },
          ],
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();

  await dialog
    .getByRole('button', { name: 'Generate with AI', exact: true })
    .click();
  await expect(dialog.getByLabel('Message')).toHaveValue(
    'Review workspace changes',
  );
  await dialog.getByLabel('Message').fill('Commit selected review notes');
  await dialog
    .getByRole('button', { name: 'Commit selected files', exact: true })
    .click();
  await expect(dialog.getByRole('status')).toHaveText('succeeded');
  expect(await git('show', '--format=', '--name-only', 'HEAD')).toBe(
    'notes.txt\n',
  );
  expect(await git('diff', '--cached', '--name-only')).toBe(staged);
  await expect(dialog).toHaveAttribute('aria-busy', 'false');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page
    .getByRole('button', { name: /Commit selected review notes/ })
    .click();
  await expect(
    page.getByRole('region', { name: 'Archived review notes' }),
  ).toContainText('This explanation must remain in History.');
});

test('reviews generated groups and commits them sequentially', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  const manifest = playgroundManifest();
  const { tokenFile, worktreePath } = JSON.parse(
    await readFile(manifest, 'utf8'),
  ) as { tokenFile: string; worktreePath: string };
  for (const name of ['group-a.txt', 'group-b.txt'])
    await writeFile(join(worktreePath, name), name);
  const git = async (...args: string[]) =>
    (await promisify(execFile)('git', ['-C', worktreePath, ...args])).stdout;
  const before = Number(await git('rev-list', '--count', 'HEAD'));
  await page.goto('/');
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const checkbox of await dialog.getByRole('checkbox').all())
    await checkbox.uncheck();
  await dialog.getByLabel('group-a.txt', { exact: true }).check();
  await dialog.getByLabel('group-b.txt', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Use groups', exact: true }).click();
  await expect(dialog.getByLabel('Message for commit 1')).toBeVisible();
  await dialog
    .getByLabel('Commit for group-b.txt')
    .selectOption({ label: 'Commit 1' });
  await dialog.getByRole('button', { name: 'Remove empty group' }).click();
  await expect(dialog.getByLabel('Message for commit 2')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Add group', exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove empty group' }).click();
  await dialog.getByRole('button', { name: 'Add group', exact: true }).click();
  await dialog
    .getByLabel('Commit for group-b.txt')
    .selectOption({ label: 'Commit 2' });
  await dialog.getByLabel('Message for commit 1').fill('First reviewed group');
  await dialog.getByLabel('Message for commit 2').fill('Second reviewed group');
  await dialog
    .getByRole('button', { name: 'Commit groups in order', exact: true })
    .click();
  await expect(
    dialog.getByText('Commit 2 · committed', { exact: true }),
  ).toBeVisible();
  expect(Number(await git('rev-list', '--count', 'HEAD'))).toBe(before + 2);
  expect(await git('log', '-2', '--format=%s')).toBe(
    'Second reviewed group\nFirst reviewed group\n',
  );
});
