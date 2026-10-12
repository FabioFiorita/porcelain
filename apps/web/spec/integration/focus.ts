import { expect } from 'vitest';
import type { Locator } from 'vitest/browser';

export async function expectInputFocus(input: Locator) {
  await expect
    .poll(() => {
      const element = input.element();
      const root = element.getRootNode();
      return 'activeElement' in root && root.activeElement === element;
    })
    .toBe(true);
}
