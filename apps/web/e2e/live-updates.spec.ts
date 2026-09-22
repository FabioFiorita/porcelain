import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

test('streams external edits, goes idle without polling, and bounds reconnect refreshes', async ({
  page,
}) => {
  const sockets: import('@playwright/test').WebSocketRoute[] = [];
  let releaseReconnect!: () => void;
  const reconnectGate = new Promise<void>((resolve) => {
    releaseReconnect = resolve;
  });
  await page.routeWebSocket('**/api/live', async (socket) => {
    sockets.push(socket);
    if (sockets.length > 1) await reconnectGate;
    socket.connectToServer();
  });
  await page.setViewportSize({ width: 1500, height: 950 });
  await pairBrowser(page);
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: /^accessibility\.md/ }).click();
  const path = 'docs/accessibility.md';
  const toolbar = page.getByTestId('document-toolbar').filter({
    has: page.getByRole('heading', { name: 'accessibility.md', exact: true }),
  });
  const mark = toolbar.getByRole('button', {
    name: `Mark ${path} as reviewed`,
    exact: true,
  });
  await expect(mark).toBeVisible();
  await page.waitForLoadState('networkidle');

  let idleRequests = 0;
  page.on('request', (request) => {
    if (
      request.resourceType() !== 'websocket' &&
      new URL(request.url()).pathname.startsWith('/api/')
    )
      idleRequests += 1;
  });
  // This interval is deliberately longer than the removed three-second file
  // poll. Absence over time is the behavior under test.
  await page.waitForTimeout(3_500);
  expect(idleRequests).toBe(0);

  const absolute = join(worktreePath, path);
  const original = await readFile(absolute, 'utf8');
  let reviewedUrl: string | undefined;
  try {
    const marked = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname.endsWith('/reviewed'),
    );
    await mark.click();
    const markedResponse = await marked;
    reviewedUrl = markedResponse.url();
    expect(markedResponse.ok()).toBe(true);
    const unmark = toolbar.getByRole('button', {
      name: `Unmark ${path} as unreviewed`,
      exact: true,
    });
    await expect(unmark).toBeVisible();
    await writeFile(absolute, `${original}\nLive edit\n`);
    const stale = toolbar.getByRole('button', {
      name: `Mark changed ${path} as reviewed`,
      exact: true,
    });
    await expect(stale).toBeVisible({ timeout: 8_000 });

    const markedAgain = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname.endsWith('/reviewed'),
    );
    await stale.click();
    expect((await markedAgain).ok()).toBe(true);
    await expect(unmark).toBeEnabled();
    await expect.poll(() => sockets.length).toBe(1);
    let reconnectReads = 0;
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/changes')) reconnectReads += 1;
    });
    const firstSocket = sockets[0];
    if (!firstSocket) throw new Error('Live socket was not established');
    await firstSocket.close({ code: 1001, reason: 'Reconnect proof' });
    await writeFile(absolute, `${original}\nChanged while offline\n`);
    releaseReconnect();
    await expect.poll(() => sockets.length, { timeout: 12_000 }).toBe(2);
    await expect(stale).toBeVisible({ timeout: 12_000 });
    await expect.poll(() => reconnectReads).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(500);
    expect(reconnectReads).toBeLessThanOrEqual(2);
  } finally {
    releaseReconnect();
    await writeFile(absolute, original);
    if (reviewedUrl) {
      const removed = await page.request.delete(
        `${reviewedUrl}?path=${encodeURIComponent(path)}`,
      );
      expect(removed.ok()).toBe(true);
    }
  }
});

test('restores a review after repeated reloads and shows external files without navigating', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  const sidebar = page.getByRole('complementary', { name: 'Review sidebar' });
  const existing = sidebar.getByRole('button', { name: /^accessibility\.md/ });
  await expect(existing).toBeVisible();
  const reviewUrl = page.url();
  const failures: string[] = [];
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.startsWith('/api/') &&
      response.status() >= 400
    )
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.reload();
    await expect(existing).toBeVisible();
    await expect(sidebar.getByRole('alert')).toHaveCount(0);
    expect(page.url()).toBe(reviewUrl);
  }
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
  const file = join(worktreePath, 'refresh-live-check.txt');
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });
  try {
    await writeFile(file, 'Created outside the browser after reloading.\n', {
      flag: 'wx',
    });
    await expect(
      sidebar.getByRole('button', { name: /^refresh-live-check\.txt/ }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(sidebar.getByRole('alert')).toHaveCount(0);
    expect(navigations).toBe(0);
    expect(failures).toEqual([]);
  } finally {
    await rm(file, { force: true });
  }
});
