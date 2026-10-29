import type { BrowserContext } from '@playwright/test';
import {
  browserNetwork,
  type RoutedRequest,
} from '@porcelain/server/kit/browser-network';

const pathOf = (request: RoutedRequest) => new URL(request.url()).pathname;

export async function capturePreviewRequests(context: BrowserContext) {
  const requests: { navigation: boolean; marker: boolean }[] = [];
  const executions: string[] = [];
  const violations: string[] = [];
  context.on('console', (message) => {
    if (message.text() === 'AUDIT_ONLY_PREVIEW_EXECUTED')
      executions.push(message.text());
    if (
      message.type() === 'error' &&
      message.text().includes('Content Security Policy')
    )
      violations.push(message.text());
  });
  await context.route(
    /https?:\/\/(?:audit-exfil\.invalid\/|[^/]+\/preview-capture(?:\?|$))/,
    async (route) => {
      requests.push({
        navigation: route.request().isNavigationRequest(),
        marker:
          new URL(route.request().url()).searchParams
            .get('d')
            ?.includes('AUDIT_ONLY_CONTENT') ?? false,
      });
      await route.fulfill({ contentType: 'text/html', body: 'Intercepted' });
    },
  );
  return { requests, executions, violations };
}

export async function liveRouter(context: BrowserContext) {
  const network = browserNetwork(context);
  await network.live.route();
  return {
    hold: network.live.hold,
    drop: network.live.drop,
    restore: network.live.restore,
    connected: network.live.connected,
    holdNextChangeDiff: (filePath: string) =>
      network.holdNext(
        (request) =>
          request.method() === 'POST' &&
          pathOf(request).endsWith('/changes/diffs') &&
          (request.postData() ?? '').includes(filePath),
        () => network.live.hold(),
      ),
    holdChangesRead: () => network.hold(isChangesRead),
    holdPublishedReviewRead: () => network.hold(isPublishedReviewRead),
    failChangesRead: () => network.fail(isChangesRead, 503),
    failPublishedReviewRead: () => network.fail(isPublishedReviewRead, 503),
    failDurableReviewRead: (reviewId: string) =>
      network.fail(
        (request) =>
          request.method() === 'GET' &&
          pathOf(request) === `/api/reviews/${reviewId}`,
        503,
      ),
    releaseHeld: network.live.release,
  };
}

export type LiveRouter = Awaited<ReturnType<typeof liveRouter>>;

export function holdNextReviewRead(context: BrowserContext) {
  return browserNetwork(context).holdNext(
    (request) =>
      request.method() === 'GET' && pathOf(request).endsWith('/review'),
  );
}

export function holdNextPost(context: BrowserContext, ending: string) {
  return browserNetwork(context).holdNext(
    (request) =>
      request.method() === 'POST' && pathOf(request).endsWith(ending),
  );
}

export function failInventory(context: BrowserContext) {
  return browserNetwork(context).fail(
    (request) => pathOf(request) === '/api/inventory',
    503,
  );
}

export function failChangesRead(context: BrowserContext) {
  return browserNetwork(context).fail(isChangesRead, 503);
}

function isChangesRead(request: RoutedRequest) {
  return (
    request.method() === 'GET' &&
    /^\/api\/worktrees\/[^/]+\/changes$/.test(pathOf(request))
  );
}

function isPublishedReviewRead(request: RoutedRequest) {
  return (
    request.method() === 'GET' &&
    /^\/api\/worktrees\/[^/]+\/review$/.test(pathOf(request))
  );
}

export function failRemoteStatus(context: BrowserContext, address: string) {
  return browserNetwork(context).fail(
    (request) => request.url() === `${address}/api/environment`,
    503,
  );
}

export function reviewSeenRequests(context: BrowserContext) {
  const counts = new Map<string, number>();
  const matches = (reviewId: string) => (request: RoutedRequest) =>
    request.method() === 'PUT' &&
    pathOf(request) === `/api/reviews/${reviewId}/seen`;
  context.on('request', (request) => {
    if (request.method() === 'PUT') {
      const path = pathOf(request);
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  });
  const network = browserNetwork(context);
  return {
    count: (reviewId: string) =>
      counts.get(`/api/reviews/${reviewId}/seen`) ?? 0,
    fail: (reviewId: string) => network.fail(matches(reviewId), 503),
    holdNext: (reviewId: string) => network.holdNext(matches(reviewId)),
  };
}
