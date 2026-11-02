import type { Page } from '@playwright/test';

declare const document: {
  querySelector: (selector: string) => {
    querySelector: (selector: string) => { open: boolean } | null;
    querySelectorAll: (selector: string) => ArrayLike<{
      alt: string;
      naturalWidth: number;
      width: number;
      parentElement: { clientWidth: number } | null;
    }>;
  } | null;
};

export async function markdownImageState(page: Page) {
  return page.evaluate(() => {
    const article = document.querySelector('article');
    return {
      open: article?.querySelector('details')?.open ?? false,
      unsafe:
        article?.querySelectorAll(
          'script,iframe,[onclick],[onerror],a[href^="javascript:"]',
        ).length ?? 0,
      images: Array.from(article?.querySelectorAll('img') ?? [], (image) => ({
        alt: image.alt,
        width: image.naturalWidth,
        fits: image.width <= (image.parentElement?.clientWidth ?? 0),
      })),
    };
  });
}
