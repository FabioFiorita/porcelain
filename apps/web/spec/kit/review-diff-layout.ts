import type { Page } from '@playwright/test';

type LayoutElement = {
  querySelector(selector: string): LayoutElement | null;
  querySelectorAll(selector: string): readonly LayoutElement[];
  readonly shadowRoot: LayoutElement | null;
  getBoundingClientRect(): { top: number; bottom: number; height: number };
};

declare const document: Pick<LayoutElement, 'querySelector'>;

export function reviewDiffLayout(page: Page) {
  const diffs = page
    .getByRole('region', { name: 'Code content', exact: true })
    .first();
  return {
    read: () =>
      page.evaluate(() => {
        const section = document
          .querySelector('section[aria-label="Existing code it relies on"]')
          ?.getBoundingClientRect();
        const region = document.querySelector(
          '[role="region"][aria-label="Code content"]',
        );
        if (!section || !region) return null;
        const blocks = [...region.querySelectorAll('diffs-container')];
        const overlaps: string[] = [];
        let notes = 0;
        let wrapped = false;
        for (const [index, block] of blocks.entries()) {
          if (!block.shadowRoot) return null;
          const rows = [...block.shadowRoot.querySelectorAll('[data-line]')];
          wrapped ||= rows.some(
            (row) => row.getBoundingClientRect().height > 20,
          );
          notes += block.querySelectorAll(
            'aside[aria-label^="Agent note"]',
          ).length;
          const contents = [
            ...block.shadowRoot.querySelectorAll('pre, [data-line]'),
            ...block.querySelectorAll('aside, article'),
          ];
          for (const content of contents) {
            const box = content.getBoundingClientRect();
            if (box.bottom > section.top)
              overlaps.push(
                `Diff ${index + 1} extends ${box.bottom - section.top}px into the next section`,
              );
          }
        }
        return { files: blocks.length, notes, wrapped, overlaps };
      }),
    async commentOnLastLine() {
      const last = diffs.locator('diffs-container').last();
      await last.locator('[data-column-number]').last().click();
      await last.locator('[data-utility-button]').click();
    },
  };
}
