import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  issuePairingResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';
import {
  readInventoryResponseSchema,
  registerProjectResponseSchema,
} from '@porcelain/contracts/projects';
import {
  publishReviewResponseSchema,
  type PublishReviewRequest,
} from '@porcelain/contracts/reviews';
import {
  appRequest,
  expect,
  responsePolicy,
  test,
  type Page,
} from './fixtures.ts';

declare const parent: { readonly document: unknown };

const sandbox = 'allow-scripts allow-forms allow-popups allow-modals';

async function publishSummary(page: Page, repository: string, title: string) {
  const project = registerProjectResponseSchema.parse(
    await appRequest(page, 'POST', '/api/projects', { path: repository }),
  );
  const worktree = project.worktrees.find((entry) => entry.main);
  if (worktree === undefined)
    throw new Error('The summary project has no main worktree');
  const review: PublishReviewRequest = {
    expectedRevision: 0,
    summaryHtml: `<html><body><h1>${title}</h1><a href="#layer-1">Open ${title} layer</a> <a href="https://example.com/">Leave for a website</a></body></html>`,
    layers: [
      {
        id: randomUUID(),
        title: `${title} layer`,
        summary: 'A disposable review',
        lanes: ['Docs'],
        steps: [
          {
            id: randomUUID(),
            lane: 0,
            title: 'Readme',
            text: 'Review the readme',
            kind: 'context',
            pointer: { path: 'README.md', startLine: 1, endLine: 1 },
          },
        ],
      },
    ],
  };
  const published = publishReviewResponseSchema.parse(
    await appRequest(
      page,
      'PUT',
      `/api/worktrees/${worktree.id}/review`,
      review,
    ),
  );
  const summaryUrl =
    publishReviewResponseSchema.encode(published).review?.summary.url;
  if (summaryUrl === undefined)
    throw new Error('The published summary is missing');
  return { project, worktree, summaryUrl };
}

test('a local signed summary renders through the app origin in its sandbox, keeps the theme and opens its layer link', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  const here = await publishSummary(page, desktop.repository, 'Local summary');
  await page.goto(
    `porcelain://app/${here.project.id}/${here.worktree.id}?entry=handoff`,
  );
  const summary = page.frameLocator('iframe[title="Review summary"]');
  await expect(
    summary.getByRole('heading', { name: 'Local summary', exact: true }),
  ).toBeVisible();
  expect(await responsePolicy(page, here.summaryUrl)).toBe(
    `sandbox ${sandbox}`,
  );
  await expect(
    summary.locator('html[data-theme="dark"], html[data-theme="light"]'),
  ).toHaveCount(1);
  await summary
    .getByRole('link', { name: 'Open Local summary layer', exact: true })
    .click();
  await expect(
    page.getByRole('region', {
      name: 'Review layer Local summary layer',
      exact: true,
    }),
  ).toBeVisible();
  expect(app.electron.windows()).toHaveLength(1);
  expect(app.errors).toEqual([]);
});

test('a remote computer summary renders through the app from that computer, cannot reach the app, Node or the bridge, and cannot show a website', async ({
  desktop,
}, testInfo) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  const other = await desktop.launch(join(desktop.folder, 'remote-profile'));
  const otherPage = await other.window();
  await expect(
    otherPage.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  const there = await publishSummary(
    otherPage,
    desktop.repository,
    'Remote summary',
  );
  const status = await other.server();
  const [grant] = issuePairingResponseSchema.parse(
    await other.askOwner('POST', '/pairings', {
      labels: ['Desktop summary proof'],
      addresses: [status.address],
    }),
  ).grants;
  if (grant === undefined)
    throw new Error('The remote pairing grant is missing');
  const remote = readInventoryResponseSchema.parse(
    await appRequest(otherPage, 'GET', '/api/inventory'),
  );

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('button', { name: 'Remote computers', exact: true })
    .click();
  await settings
    .getByRole('textbox', { name: 'Pairing link', exact: true })
    .fill(pairingLink(grant.link));
  await settings.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    settings
      .getByRole('list', { name: 'Remote computers', exact: true })
      .getByRole('listitem', { name: remote.environment.name, exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(settings).toBeHidden();
  const computer = page.getByRole('group', {
    name: remote.environment.name,
    exact: true,
  });
  if (!(await computer.isVisible()))
    await page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
  await computer.getByRole('button', { name: /Main worktree/ }).click();
  const remoteWorktree = `/remotes/${remote.environmentId}/${there.project.id}/${there.worktree.id}`;
  await page.waitForURL((url) => url.pathname === remoteWorktree);
  const summary = page.frameLocator('iframe[title="Review summary"]');
  await expect(
    summary.getByRole('heading', { name: 'Remote summary', exact: true }),
  ).toBeVisible();
  const frame = page
    .frames()
    .find((entry) =>
      entry.url().startsWith('porcelain://app/remote-review-summaries/'),
    );
  if (frame === undefined)
    throw new Error('The remote summary did not load through the app');
  expect(new URL(frame.url()).searchParams.get('computer')).toBe(
    new URL(status.address).origin,
  );
  await expect(
    frame.locator('html[data-theme="dark"], html[data-theme="light"]'),
  ).toHaveCount(1);
  expect(
    await frame.evaluate(() => {
      const parentReadable = (() => {
        try {
          return parent.document !== null;
        } catch {
          return false;
        }
      })();
      return {
        parentReadable,
        node: 'require' in globalThis,
        bridge: 'porcelainDesktop' in globalThis,
      };
    }),
  ).toEqual({ parentReadable: false, node: false, bridge: false });
  await expect(page.locator('iframe[title="Review summary"]')).toHaveAttribute(
    'sandbox',
    sandbox,
  );
  await summary
    .getByRole('link', { name: 'Open Remote summary layer', exact: true })
    .click();
  await expect(
    page.getByRole('region', {
      name: 'Review layer Remote summary layer',
      exact: true,
    }),
  ).toBeVisible();
  const policy = (await responsePolicy(page, '/'))?.split('; ') ?? [];
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("frame-src 'self' blob:");
  expect(app.errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('remote-layer.png') });

  await page
    .getByRole('tablist', { name: 'Open documents', exact: true })
    .getByTitle('Review summary', { exact: true })
    .click();
  const refused = page.waitForEvent('console', {
    predicate: (message) =>
      message.text().includes("'https://example.com/'") &&
      message.text().includes('frame-src'),
  });
  await summary
    .getByRole('link', { name: 'Leave for a website', exact: true })
    .click();
  await refused;
  expect(
    page
      .frames()
      .map((entry) => entry.url())
      .filter((url) => url.startsWith('https:')),
  ).toEqual([]);
});
