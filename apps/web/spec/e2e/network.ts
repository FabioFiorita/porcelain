import type { BrowserContext } from '@playwright/test';
import {
  browserNetwork,
  type RoutedRequest,
} from '@porcelain/server/kit/browser-network';

const pathOf = (request: RoutedRequest) => new URL(request.url()).pathname;

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
  return browserNetwork(context).fail(
    (request) =>
      request.method() === 'GET' &&
      /^\/api\/worktrees\/[^/]+\/changes$/.test(pathOf(request)),
    503,
  );
}
