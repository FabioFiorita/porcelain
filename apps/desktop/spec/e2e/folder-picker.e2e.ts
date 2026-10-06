import { Schema } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { appRequest, expect, test, type Page } from './fixtures.ts';

async function registered(page: Page): Promise<string[]> {
  return Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await appRequest(page, 'GET', '/api/inventory'),
  ).projects.flatMap((project) =>
    project.worktrees.map((worktree) => worktree.path),
  );
}

function folderRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/projects/folders')
      requests.push(request.url());
  });
  return requests;
}

test('the Open Project menu opens the native folder sheet directly, and canceling it registers nothing', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  const browsing = folderRequests(page);
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  expect(await registered(page)).toEqual([]);

  await app.holdPicker();
  await app.clickMenu('open-project');
  expect(await app.pickerRequest()).toEqual({
    ownerIsAppWindow: true,
    title: 'Open project',
    buttonLabel: 'Open project',
    defaultPath: desktop.repository,
    properties: ['openDirectory'],
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await app.answerPicker({ canceled: true, filePaths: [] });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await registered(page)).toEqual([]);
  expect(browsing).toEqual([]);
  expect(app.errors).toEqual([]);
});

test('the Open project button opens the chosen Git repository through the native sheet, without folder browsing, and the app serves its history and live file changes', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  const browsing = folderRequests(page);
  await app.holdPicker();
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  expect(await app.pickerRequest()).toEqual({
    ownerIsAppWindow: true,
    title: 'Open project',
    buttonLabel: 'Open project',
    defaultPath: desktop.repository,
    properties: ['openDirectory'],
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await app.answerPicker({ canceled: false, filePaths: [desktop.repository] });
  const project = page.getByRole('button', {
    name: 'desktop-smoke',
    exact: true,
  });
  await expect(project).toBeVisible();
  expect(await registered(page)).toEqual([desktop.repository]);
  expect(browsing).toEqual([]);

  await project.click();
  await page.waitForURL((url) => url.pathname !== '/');
  await page.reload();
  await expect(project).toBeVisible();
  const reviewToggle = page.getByRole('button', {
    name: 'Review',
    exact: true,
  });
  if (await reviewToggle.isVisible()) await reviewToggle.click();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Create smoke project', exact: false }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: 'README.md', exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open', exact: true }).click();
  await expect(page.getByText('Desktop smoke', { exact: true })).toBeVisible();
  await writeFile(
    join(desktop.repository, 'README.md'),
    '# Desktop smoke\n\nUpdated on disk through the desktop server.\n',
  );
  await expect(
    page.getByText('Updated on disk through the desktop server.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(app.errors).toEqual([]);
});
