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

declare const parent: {
  readonly document: unknown;
  postMessage(data: unknown, origin: string): void;
};
declare function addEventListener(
  type: 'message',
  listener: (event: { data: unknown }) => void,
): void;
declare const document: {
  hasFocus(): boolean;
  readonly activeElement: { getAttribute(name: string): string | null } | null;
  addEventListener(
    type: 'click',
    listener: (event: {
      isTrusted: boolean;
      defaultPrevented: boolean;
      target: {
        nodeName?: string;
        getAttribute?(name: string): string | null;
      } | null;
    }) => void,
    capture?: boolean,
  ): void;
  addEventListener(
    type: 'securitypolicyviolation',
    listener: (event: {
      blockedURI: string;
      effectiveDirective: string;
      disposition: string;
    }) => void,
  ): void;
};

const sandbox = 'allow-scripts allow-forms allow-popups allow-modals';

async function watchSummaryClicks(
  page: Page,
  frame: ReturnType<Page['frames']>[number],
) {
  const marker = randomUUID();
  await page.evaluate((marker) => {
    const clicks: unknown[] = [];
    Reflect.set(globalThis, 'porcelainSummaryClicks', clicks);
    addEventListener('message', (event) => {
      const data = event.data;
      if (
        typeof data === 'object' &&
        data !== null &&
        Reflect.get(data, 'source') === marker
      ) {
        const click: unknown = Reflect.get(data, 'click');
        clicks.push(click);
      }
    });
  }, marker);
  await frame.evaluate((marker) => {
    document.addEventListener(
      'click',
      (event) => {
        parent.postMessage(
          {
            source: marker,
            click: {
              trusted: event.isTrusted,
              preventedAtCapture: event.defaultPrevented,
              target: event.target?.nodeName,
              href: event.target?.getAttribute?.('href'),
              focused: document.hasFocus(),
            },
          },
          '*',
        );
      },
      true,
    );
  }, marker);
}

function summaryClicks(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const clicks: unknown = Reflect.get(globalThis, 'porcelainSummaryClicks');
    return clicks;
  });
}

async function focusSummaryLink(
  frame: ReturnType<Page['frames']>[number],
  name: string,
  href: string,
) {
  const link = frame.getByRole('link', { name, exact: true });
  await link.focus();
  await expect
    .poll(() =>
      frame.evaluate(() => ({
        focused: document.hasFocus(),
        href: document.activeElement?.getAttribute('href'),
      })),
    )
    .toEqual({ focused: true, href });
  return link;
}

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

  await other.electron.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The remote window is missing');
    await new Promise<void>((resolve) => {
      view.once('closed', resolve);
      view.close();
    });
  });
  expect((await other.server()).pid).toBe(status.pid);
  await app.electron.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The app window is missing');
    view.focus();
    view.webContents.focus();
  });
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);

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
  await frame.waitForLoadState('load');
  await watchSummaryClicks(page, frame);
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
  try {
    const layerLink = await focusSummaryLink(
      frame,
      'Open Remote summary layer',
      '#layer-1',
    );
    await layerLink.press('Enter');
    await expect
      .poll(() => summaryClicks(page))
      .toContainEqual({
        trusted: true,
        preventedAtCapture: false,
        target: 'A',
        href: '#layer-1',
        focused: true,
      });
    await expect(
      page.getByRole('region', {
        name: 'Review layer Remote summary layer',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await testInfo.attach('summary-layer-input', {
      body: JSON.stringify({
        clicks: await summaryClicks(page),
        focused: await page.evaluate(() => document.hasFocus()),
        frameHash: new URL(frame.url()).hash,
      }),
      contentType: 'application/json',
    });
  }
  const policy = (await responsePolicy(page, '/'))?.split('; ') ?? [];
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("frame-src 'self' blob:");
  expect(app.errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('remote-layer.png') });

  const summaryNavigation = page.waitForEvent('framenavigated', {
    predicate: (entry) =>
      entry.url().startsWith('porcelain://app/remote-review-summaries/'),
  });
  await page
    .getByRole('tablist', { name: 'Open documents', exact: true })
    .getByTitle('Review summary', { exact: true })
    .click();
  const reopenedSummary = await summaryNavigation;
  await reopenedSummary.waitForLoadState('load');
  await watchSummaryClicks(page, reopenedSummary);
  await app.electron.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The app window is missing');
    view.focus();
    view.webContents.focus();
  });
  await expect
    .poll(() =>
      app.electron.evaluate(({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0];
        return view?.isFocused() && view.webContents.isFocused();
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const refusals: {
      blockedURL: string;
      directive: string;
      disposition: string;
    }[] = [];
    Reflect.set(globalThis, 'porcelainFrameRefusals', refusals);
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.effectiveDirective === 'frame-src')
        refusals.push({
          blockedURL: URL.canParse(event.blockedURI)
            ? new URL(event.blockedURI).href
            : event.blockedURI,
          directive: event.effectiveDirective,
          disposition: event.disposition,
        });
    });
  });
  await app.electron.evaluate(({ session }) => {
    const attempts: string[] = [];
    Reflect.set(session.defaultSession, 'porcelainWebsiteRequests', attempts);
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['https://example.com/*'] },
      (request, callback) => {
        attempts.push(request.url);
        callback({ cancel: true });
      },
    );
  });
  const navigationState = () =>
    Promise.allSettled([
      app.electron.evaluate(({ BrowserWindow, session }) => {
        const view = BrowserWindow.getAllWindows()[0];
        const requests: unknown = Reflect.get(
          session.defaultSession,
          'porcelainWebsiteRequests',
        );
        return {
          windowFocused: view?.isFocused(),
          contentsFocused: view?.webContents.isFocused(),
          requests,
        };
      }),
      page.evaluate(() => {
        const refusals: unknown = Reflect.get(
          globalThis,
          'porcelainFrameRefusals',
        );
        const clicks: unknown = Reflect.get(
          globalThis,
          'porcelainSummaryClicks',
        );
        return { focused: document.hasFocus(), refusals, clicks };
      }),
      reopenedSummary.evaluate(() => ({
        focused: document.hasFocus(),
        activeHref: document.activeElement?.getAttribute('href'),
      })),
    ]).then((results) =>
      results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            },
      ),
    );
  const beforeClick = await navigationState();
  let afterClick: Awaited<ReturnType<typeof navigationState>> | undefined;
  try {
    const websiteLink = await focusSummaryLink(
      reopenedSummary,
      'Leave for a website',
      'https://example.com/',
    );
    await websiteLink.press('Enter');
    afterClick = await navigationState();
    await expect
      .poll(() => summaryClicks(page))
      .toContainEqual({
        trusted: true,
        preventedAtCapture: false,
        target: 'A',
        href: 'https://example.com/',
        focused: true,
      });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const refusals: unknown = Reflect.get(
            globalThis,
            'porcelainFrameRefusals',
          );
          return refusals;
        }),
      )
      .toContainEqual({
        blockedURL: 'https://example.com/',
        directive: 'frame-src',
        disposition: 'enforce',
      });
    expect(
      await app.electron.evaluate(({ session }) => {
        const attempts: unknown = Reflect.get(
          session.defaultSession,
          'porcelainWebsiteRequests',
        );
        return attempts;
      }),
    ).toEqual([]);
  } finally {
    await testInfo.attach('summary-navigation-state', {
      body: JSON.stringify({
        beforeClick,
        afterClick,
        settled: await navigationState(),
      }),
      contentType: 'application/json',
    });
    await app.electron.evaluate(({ session }) =>
      session.defaultSession.webRequest.onBeforeRequest(null),
    );
  }
  expect(new URL(page.url()).pathname).toBe(remoteWorktree);
  expect(app.electron.windows()).toHaveLength(1);
  expect(
    page
      .frames()
      .map((entry) => entry.url())
      .filter((url) => url.startsWith('https:')),
  ).toEqual([]);
});
