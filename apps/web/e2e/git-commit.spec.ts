import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import type { ReviewLayer } from '@porcelain/contracts/review';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

test('commits the selected new file and leaves other staged changes in place', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
  const git = async (...args: string[]) =>
    (await promisify(execFile)('git', ['-C', worktreePath, ...args])).stdout;
  const staged = await git('diff', '--cached', '--name-only');
  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const checkbox of await dialog.getByRole('checkbox').all())
    await checkbox.uncheck();
  await dialog.getByLabel('notes.txt', { exact: true }).check();
  const inventory = await (await page.request.get('/api/inventory')).json();
  const project = inventory.projects.find(
    (entry: { worktrees: { path: string }[] }) =>
      entry.worktrees.some((worktree) => worktree.path === worktreePath),
  );
  const worktree = project?.worktrees.find(
    (entry: { path: string }) => entry.path === worktreePath,
  );
  const reviewUrl = `/api/worktrees/${worktree.id}/review`;
  const { review: source } = await (await page.request.get(reviewUrl)).json();
  const originalSummary = await (
    await page.request.get(source.summary.url)
  ).text();
  const layerId = randomUUID();
  const response = await page.request.put(reviewUrl, {
    data: {
      expectedRevision: source.revision,
      summaryHtml: '<h1>Review notes</h1>',
      layers: [
        {
          id: layerId,
          title: 'Preserve review explanation',
          summary: 'Why these notes matter',
          lanes: ['Notes'],
          steps: [
            {
              id: randomUUID(),
              title: 'Review notes',
              text: 'This explanation remains in the latest review after commit.',
              lane: 0,
              kind: 'changed',
              pointer: { path: 'notes.txt', startLine: 1, endLine: 1 },
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
  // The commit opens and shows what it changed.
  await expect(
    page.getByRole('heading', { name: /^[0-9a-f]{7}$/ }),
  ).toBeVisible();

  const { review: afterCommit } = await (
    await page.request.get(reviewUrl)
  ).json();
  expect(afterCommit.active).toBe(false);
  expect(afterCommit.layers[0].id).toBe(layerId);
  expect(afterCommit.layers[0].steps[0].location.state).toBe('committed');
  expect(afterCommit.layers[0].steps[0].text).toContain(
    'remains in the latest review',
  );
  // Restore the shared playground publication for subsequent navigation specs.
  const restored = await page.request.put(reviewUrl, {
    data: {
      expectedRevision: afterCommit.revision,
      summaryHtml: originalSummary.replace(
        /<style id="porcelain-theme">[\s\S]*?<\/script>/,
        '',
      ),
      layers: source.layers.map(
        ({ fingerprint: _fingerprint, steps, ...layer }: ReviewLayer) => ({
          ...layer,
          steps: steps.map(({ location: _location, pointer, ...step }) => ({
            ...step,
            pointer: {
              path: pointer.path,
              startLine: pointer.startLine,
              endLine: pointer.endLine,
              ...(pointer.symbol ? { symbol: pointer.symbol } : {}),
            },
          })),
        }),
      ),
      ...(source.diagram ? { diagram: source.diagram } : {}),
    },
  });
  expect(restored.ok()).toBeTruthy();
});

test('reviews generated groups and commits them sequentially', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
  for (const name of ['group-a.txt', 'group-b.txt'])
    await writeFile(join(worktreePath, name), name);
  const git = async (...args: string[]) =>
    (await promisify(execFile)('git', ['-C', worktreePath, ...args])).stdout;
  const before = Number(await git('rev-list', '--count', 'HEAD'));
  await pairBrowser(page);
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
