import type { Locator } from 'vitest/browser';

function uncovered(element: Element) {
  const box = element.getBoundingClientRect();
  const hit = document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
  );
  return hit !== null && element.contains(hit);
}

function highlightedLines(locator: Locator) {
  return [...locator.element().querySelectorAll('diffs-container')].flatMap(
    (host) => [
      ...(host.shadowRoot?.querySelectorAll(
        '[data-code] [data-selected-line]',
      ) ?? []),
    ],
  );
}

export const reviewLayout = {
  currentChangeRows(table: Locator) {
    return [
      ...table.element().querySelectorAll('button[aria-current="true"]'),
    ].map((button) => button.textContent?.replace(/\s/g, ''));
  },
  reviewControlLabels(controls: Locator) {
    return controls
      .elements()
      .map((button) => button.getAttribute('aria-label'));
  },
  scrollToEnd(locator: Locator) {
    const element = locator.element();
    element.scrollTop = element.scrollHeight;
  },
  scrollTop: (locator: Locator) => locator.element().scrollTop,
  continuity(page: Locator) {
    const mounted = page.element();
    let reloaded = false;
    const observer = new MutationObserver((records) => {
      reloaded ||= records.some((record) =>
        Array.from(record.addedNodes).some(
          (node) =>
            node instanceof Element &&
            [node, ...node.querySelectorAll('[role="status"]')].some(
              (status) =>
                status.getAttribute('role') === 'status' &&
                status.textContent === 'Loading review…',
            ),
        ),
      );
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return {
      read: () => ({ remounted: page.query() !== mounted, reloaded }),
      stop: () => observer.disconnect(),
    };
  },
  focus(locator: Locator) {
    locator.element().focus();
  },
  tabInsideStrip(locator: Locator) {
    const tab = locator.element();
    const viewport = tab.closest('[role="tablist"]')?.parentElement;
    if (!viewport) return false;
    const chip = tab.getBoundingClientRect();
    const visible = viewport.getBoundingClientRect();
    return chip.left >= visible.left - 1 && chip.right <= visible.right + 1;
  },
  tabStripResized(locator: Locator) {
    const viewport = locator
      .element()
      .closest('[role="tablist"]')?.parentElement;
    if (!viewport) throw new Error('The tab has no strip viewport');
    const width = viewport.clientWidth;
    return new Promise<void>((resolve) => {
      const observer = new ResizeObserver(() => {
        if (viewport.clientWidth === width) return;
        observer.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      observer.observe(viewport);
    });
  },
  titleLines(locator: Locator) {
    const title = locator.element();
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
    const text = document.createRange();
    text.selectNodeContents(title);
    const lines = new Set(Array.from(text.getClientRects(), (box) => box.top));
    return {
      withinThreeLines:
        title.getBoundingClientRect().height <= lineHeight * 3 + 1,
      clipped: lines.size > 3,
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
  paneWidth(locator: Locator) {
    return (
      locator
        .element()
        .closest('[aria-label="Review walkthrough"]')
        ?.getBoundingClientRect().width ?? 0
    );
  },
  hasAnchor(locator: Locator) {
    return locator.query() !== null;
  },
  highlightedCode(locator: Locator) {
    return highlightedLines(locator)
      .map((line) => line.textContent)
      .join('\n');
  },
  highlightVisible(locator: Locator) {
    return highlightedLines(locator).some((line) => {
      const box = line.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    });
  },
};
