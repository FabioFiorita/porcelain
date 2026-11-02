import type { Page } from '@playwright/test';

export function reviewDiffLayout(page: Page) {
  const diffs = page
    .getByRole('region', { name: 'Code content', exact: true })
    .first();
  return {
    async read() {
      const section = await page
        .getByRole('region', {
          name: 'Existing code it relies on',
          exact: true,
        })
        .boundingBox();
      if (!section) throw new Error('Missing existing-code section');
      const blocks = await diffs.locator('diffs-container').all();
      const overlaps: string[] = [];
      for (const [index, block] of blocks.entries()) {
        for (const content of await block
          .locator('pre, [data-line], aside, article')
          .all()) {
          const box = await content.boundingBox();
          if (box && box.y + box.height > section.y)
            overlaps.push(
              `Diff ${index + 1} extends ${box.y + box.height - section.y}px into the next section`,
            );
        }
      }
      const rows = await diffs.locator('[data-line]').all();
      const boxes = await Promise.all(rows.map((row) => row.boundingBox()));
      return {
        files: blocks.length,
        notes: await diffs.locator('aside[aria-label^="Agent note"]').count(),
        wrapped: boxes.some((box) => box !== null && box.height > 20),
        overlaps,
      };
    },
    async commentOnLastLine() {
      const last = diffs.locator('diffs-container').last();
      await last.locator('[data-column-number]').last().click();
      await last.locator('[data-utility-button]').click();
    },
  };
}
