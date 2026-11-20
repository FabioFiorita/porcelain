import { expect, test } from './fixtures.ts';
import { openThisComputer } from '../kit/settings.ts';
import {
  connectionHistoryAt,
  withoutWebLocks,
  failHistoryWrites,
  seedObsoleteHistorySnapshot,
  emitNetworkChange,
  savedHistory,
  historySnapshotCount,
  exportedHistory,
} from '../kit/connection-history.ts';

test('browser Settings uses the same three sections and exposes host-gated Devices and computer details', async ({
  pairedPage,
  server,
  app,
}) => {
  const host = (await server.inventory()).environment.name;
  const project = (await server.project()).name;
  const offered = await server.serviceUpdate();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const navigator = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  await expect(navigator.getByText('Porcelain', { exact: true })).toBeVisible();
  await expect(
    navigator.getByRole('img', { name: `Computer: ${host}`, exact: true }),
  ).not.toBeAttached();
  await expect(
    navigator.getByRole('button', {
      name: `Project actions: ${project} · ${host}`,
      exact: true,
    }),
  ).toBeVisible();

  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  const sections = settings.getByRole('navigation', {
    name: 'Settings sections',
    exact: true,
  });
  await expect(sections.getByRole('button')).toHaveText([
    'General',
    'Changes & Git',
    'Computers',
  ]);
  await expect(
    settings.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await openThisComputer(pairedPage);
  await expect(
    settings.getByText(offered.version ?? '', { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', {
      name: 'Disconnect this browser',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    settings.getByRole('list', {
      name: 'Paired devices and links',
      exact: true,
    }),
  ).toBeVisible();
  await app.follow('/settings/computers/a-saved-computer');
  await expect(
    settings.getByText(
      'This computer is no longer saved on this app. Return to Computers to add it again.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('two tabs retain both connection events after one closes without Web Locks', async ({
  pairedPage,
}) => {
  const context = pairedPage.context();
  await withoutWebLocks(context);
  await connectionHistoryAt(pairedPage);
  const second = await context.newPage();
  await connectionHistoryAt(second);

  await Promise.all([
    emitNetworkChange(pairedPage, 'offline'),
    emitNetworkChange(second, 'online'),
  ]);
  await expect(
    pairedPage.getByText('Network offline', { exact: true }),
  ).toBeVisible();
  await expect(
    second.getByText('Network online', { exact: true }),
  ).toBeVisible();
  await pairedPage.close();

  const reopened = await context.newPage();
  await connectionHistoryAt(reopened);
  await expect(
    reopened.getByText('Network offline', { exact: true }),
  ).toBeVisible();
  await expect(
    reopened.getByText('Network online', { exact: true }),
  ).toBeVisible();
});

test('recovering old buffered events leaves the newest 100 in connection history', async ({
  pairedPage,
}) => {
  await connectionHistoryAt(pairedPage);
  const second = await pairedPage.context().newPage();
  await connectionHistoryAt(second);

  const failure = await failHistoryWrites(pairedPage);
  try {
    await emitNetworkChange(pairedPage, 'offline');
    await expect.poll(() => failure.attempts()).toBeGreaterThan(0);
    await expect(
      pairedPage.getByText('Network offline', { exact: true }),
    ).toBeVisible();
    await emitNetworkChange(
      second,
      ...Array.from({ length: 100 }, () => 'online' as const),
    );
    await expect(
      second.getByText('Network online', { exact: true }),
    ).toHaveCount(100);
  } finally {
    await failure.restore();
  }

  await emitNetworkChange(pairedPage, 'offline');
  await expect(
    pairedPage.getByText('Network offline', { exact: true }),
  ).toHaveCount(1);
  await expect(
    pairedPage.getByText('Network online', { exact: true }),
  ).toHaveCount(99);
  await expect.poll(() => historySnapshotCount(pairedPage)).toBe(2);
  const exported = await exportedHistory(pairedPage);
  await expect
    .poll(() => exported.map(({ event }) => event))
    .toEqual([
      ...Array.from({ length: 99 }, () => 'Network online'),
      'Network offline',
    ]);
});

test('history keeps successive events across storage write failures and saves them when storage recovers', async ({
  pairedPage: page,
}) => {
  const openHistory = await connectionHistoryAt(page);
  await expect.poll(() => savedHistory(page)).toContain('Document navigation');

  const failure = await failHistoryWrites(page);
  try {
    await emitNetworkChange(page, 'offline', 'online');
    await expect.poll(() => failure.attempts()).toBeGreaterThan(0);
    await expect(
      page.getByText('Network online', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Network offline', { exact: true }),
    ).toBeVisible();
  } finally {
    await failure.restore();
  }

  await emitNetworkChange(page, 'offline');
  await expect.poll(() => savedHistory(page)).toContain('Network online');
  await page.reload();
  await openHistory();
  await expect(page.getByText('Network offline', { exact: true })).toHaveCount(
    2,
  );
  await expect(page.getByText('Network online', { exact: true })).toBeVisible();
});

test('history reclaims an obsolete snapshot when storage is full', async ({
  pairedPage: page,
}) => {
  const openHistory = await connectionHistoryAt(page);
  await expect.poll(() => savedHistory(page)).toContain('Document navigation');
  const obsolete = await seedObsoleteHistorySnapshot(page);
  const quota = await failHistoryWrites(page, obsolete);
  try {
    await emitNetworkChange(page, 'offline');
    await expect.poll(() => quota.attempts()).toBeGreaterThan(0);
    await expect.poll(() => savedHistory(page)).toContain('Network offline');
  } finally {
    await quota.restore();
  }
  await page.reload();
  await openHistory();
  await expect(
    page.getByText('Network offline', { exact: true }),
  ).toBeVisible();
});
