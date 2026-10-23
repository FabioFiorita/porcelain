import type { Locator } from 'vitest/browser';

export const reviewLayout = {
  titleLines(locator: Locator) {
    const title = locator.element();
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
    return {
      withinThreeLines:
        title.getBoundingClientRect().height <= lineHeight * 3 + 1,
      clipped: title.scrollHeight > title.clientHeight,
    };
  },
  fitsViewport(locator: Locator) {
    const button = locator.element();
    const bounds = button.getBoundingClientRect();
    return {
      insideViewport: bounds.left >= 0 && bounds.right <= window.innerWidth,
      contentFits: button.scrollWidth <= button.clientWidth,
    };
  },
};
