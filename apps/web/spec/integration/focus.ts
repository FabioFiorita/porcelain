import { expect } from 'vite-plus/test';
import type { Locator } from 'vite-plus/test/browser';

export async function expectInputFocus(input: Locator) {
  await expect
    .poll(() => {
      const element = input.element();
      const root = element.getRootNode();
      return 'activeElement' in root && root.activeElement === element;
    })
    .toBe(true);
}
