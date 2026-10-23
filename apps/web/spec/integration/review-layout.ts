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
