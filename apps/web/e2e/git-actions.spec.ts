import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

test('creates and switches a branch, then restores a discarded new file', async ({
  page,
}) => {
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
  const git = async (...args: string[]) =>
    (
      await promisify(execFile)('git', ['-C', worktreePath, ...args])
    ).stdout.trim();
  const original = await git('branch', '--show-current');
  const branch = `browser-${randomUUID()}`;
  const file = `restore-${test.info().project.name}.txt`;
  const contents = 'Keep these notes after undo.\n';
  await writeFile(join(worktreePath, file), contents);
  try {
    await pairBrowser(page);
    await openNavigation(page);
    await page.getByRole('button', { name: /^review / }).click();
    await page
      .getByRole('button', { name: 'Git actions', exact: true })
      .click();
    await page.getByRole('menuitem', { name: /^Create branch/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Create branch' });
    await dialog.getByRole('textbox', { name: 'Branch name' }).fill(branch);
    await dialog
      .getByRole('button', { name: 'Create branch', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(await git('branch', '--show-current')).toBe(branch);
    await page
      .getByRole('region', { name: 'Review content', exact: true })
      .getByRole('button', {
        name: new RegExp(`^${file.replaceAll('.', '\\.')}`),
      })
      .click();
    await page
      .getByRole('button', { name: `Discard changes to ${file}`, exact: true })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Discard', exact: true })
      .click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect
      .poll(async () =>
        readFile(join(worktreePath, file), 'utf8').catch(() => null),
      )
      .toBeNull();
    const restoring = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/git/actions'),
    );
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    const admission = await (await restoring).json();
    let receipt = admission;
    await expect
      .poll(async () => {
        receipt = await (
          await page.request.get(
            `/api/git-action-requests/${admission.requestId}`,
          )
        ).json();
        return receipt.state;
      })
      .not.toBe('running');
    expect(receipt, JSON.stringify(receipt)).toMatchObject({
      state: 'succeeded',
    });
    await expect
      .poll(() => readFile(join(worktreePath, file), 'utf8').catch(() => null))
      .toBe(contents);
    for (const theme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: theme as 'dark' | 'light' });
      await expect(page.locator('html')).toHaveClass(
        theme === 'dark' ? /dark/ : /^(?!.*dark)/,
      );
      await page.screenshot({
        animations: 'disabled',
        path: test.info().outputPath(`restored-discard-${theme}.png`),
      });
    }
  } finally {
    await rm(join(worktreePath, file), { force: true });
    await git('switch', original);
    await git('branch', '-D', branch).catch(() => undefined);
  }
});
