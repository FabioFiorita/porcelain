import type { Page } from '@playwright/test';
import { updateFeed } from './desktop-updates.ts';

export async function desktopSummaryHost(page: Page) {
  const origin = new URL(page.url()).origin;
  await updateFeed(page, false, `${origin.replace(/^http/u, 'ws')}/api/live`);
  await page.route(`${origin}/remote-review-summaries/*`, async (route) => {
    const source = new URL(route.request().url());
    const target = new URL(
      source.pathname.replace(
        '/remote-review-summaries/',
        '/review-summaries/',
      ),
      source.searchParams.get('computer') ?? '',
    );
    target.search = new URLSearchParams({
      expires: source.searchParams.get('expires') ?? '',
      signature: source.searchParams.get('signature') ?? '',
    }).toString();
    await route.fulfill({ response: await route.fetch({ url: target.href }) });
  });
  await page.reload();
}
