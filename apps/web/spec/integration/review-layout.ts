import type { Locator } from 'vitest/browser';

function uncovered(element: Element) {
  const box = element.getBoundingClientRect();
  const hit = document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
  );
  return hit !== null && element.contains(hit);
}

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
  bringIntoView(locator: Locator) {
    locator.element().scrollIntoView({ block: 'center' });
  },
  separate(cards: Locator) {
    const boxes = cards.elements().map((card) => card.getBoundingClientRect());
    return !boxes.some((box, index) =>
      boxes
        .slice(index + 1)
        .some((other) => box.bottom > other.top && other.bottom > box.top),
    );
  },
  placement(cards: Locator, header: Locator) {
    const edge = header.element().getBoundingClientRect().right;
    const lefts = cards
      .elements()
      .map((card) => card.getBoundingClientRect().left);
    if (lefts.length > 0 && lefts.every((left) => left > edge)) return 'margin';
    return lefts.every((left) => left < edge) ? 'inline' : 'mixed';
  },
  reachable(locator: Locator) {
    const element = locator.element();
    element.scrollIntoView({ block: 'center' });
    return uncovered(element);
  },
  holds(container: Locator, locator: Locator) {
    const outer = container.element();
    const frame = outer.getBoundingClientRect();
    const box = locator.element().getBoundingClientRect();
    return {
      inside:
        box.left >= frame.left &&
        box.right <= frame.right &&
        box.right <= window.innerWidth,
      fits: outer.scrollWidth <= outer.clientWidth,
    };
  },
};
