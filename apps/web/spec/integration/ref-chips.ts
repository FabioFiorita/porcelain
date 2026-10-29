import type { Locator } from 'vitest/browser';

export const refChips = {
  focus(locator: Locator) {
    locator.element().focus();
  },
  tooltipName() {
    return document.querySelector('[data-slot="tooltip-content"][data-open]')
      ?.textContent;
  },
  sharesLine(chip: Locator, text: Locator) {
    const chipBounds = chip.element().getBoundingClientRect();
    const textBounds = text.element().getBoundingClientRect();
    const middle = chipBounds.top + chipBounds.height / 2;
    return middle >= textBounds.top && middle <= textBounds.bottom;
  },
  sharesStart(first: Locator, second: Locator) {
    const firstLeft = first.element().getBoundingClientRect().left;
    const secondLeft = second.element().getBoundingClientRect().left;
    return Math.abs(firstLeft - secondLeft) < 1;
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
