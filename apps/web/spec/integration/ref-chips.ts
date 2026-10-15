import type { Locator } from 'vitest/browser';

export const refChips = {
  focus(locator: Locator) {
    locator.element().focus();
  },
  tooltipName() {
    return document.querySelector('[data-slot="tooltip-content"][data-open]')
      ?.textContent;
  },
  presentation(text: Locator, row: Locator, more: Locator) {
    const label = text.element();
    const rowBounds = row.element().getBoundingClientRect();
    const chipBounds = label.getBoundingClientRect();
    const moreBounds = more.element().getBoundingClientRect();
    return {
      textOverflow: getComputedStyle(label).textOverflow,
      truncated: label.scrollWidth > label.clientWidth,
      nameInsideRow:
        chipBounds.left >= rowBounds.left &&
        chipBounds.right <= rowBounds.right,
      countInsideRow:
        moreBounds.left >= rowBounds.left &&
        moreBounds.right <= rowBounds.right,
    };
  },
};
