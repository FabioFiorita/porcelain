import type { Page, Request } from '@playwright/test';

declare const document: {
  readonly body: object;
  querySelector: (selector: string) => {
    getClientRects: () => { readonly length: number };
  } | null;
};
declare const MutationObserver: new (callback: () => void) => {
  observe: (
    target: object,
    options: {
      childList: boolean;
      subtree: boolean;
      attributes: boolean;
    },
  ) => void;
  disconnect: () => void;
};

export async function reviewReturnProbe(page: Page, reviewId: string) {
  const heavyReads: string[] = [];
  const record = (request: Request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === 'GET' &&
      (path === `/api/reviews/${reviewId}` ||
        path.startsWith('/review-summaries/'))
    )
      heavyReads.push(path);
  };
  page.on('request', record);
  const observed = await page.evaluateHandle(() => {
    const state = { loading: false };
    const observer = new MutationObserver(() => {
      const loading = document.querySelector(
        '[role="status"][aria-label="Loading review"]',
      );
      if (loading && loading.getClientRects().length > 0) state.loading = true;
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    return { state, observer };
  });
  return {
    result: async () => ({
      heavyReads,
      loading: await observed.evaluate((value) => value.state.loading),
    }),
    close: async () => {
      page.off('request', record);
      await observed.evaluate((value) => value.observer.disconnect());
      await observed.dispose();
    },
  };
}

export async function expireNextReviewLink(
  page: Page,
  worktreeId: string,
  expires: string,
  advance: () => Promise<void>,
) {
  await page.clock.setFixedTime(Date.parse(expires) + 60_000);
  await page.route(
    `**/api/worktrees/${worktreeId}/review`,
    async (route) => {
      const response = await route.fetch();
      await advance();
      await route.fulfill({ response });
    },
    { times: 1 },
  );
}
