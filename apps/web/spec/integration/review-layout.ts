import type { Locator } from 'vitest/browser';

export const reviewLayout = {
  tabInsideStrip(locator: Locator) {
    const tab = locator.element();
    const viewport = tab.closest('[role="tablist"]')?.parentElement;
    if (!viewport) return false;
    const chip = tab.getBoundingClientRect();
    const visible = viewport.getBoundingClientRect();
    return chip.left >= visible.left - 1 && chip.right <= visible.right + 1;
  },
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
