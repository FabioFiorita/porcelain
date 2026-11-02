import type { Page } from '@playwright/test';

export async function reviewHeaders(page: Page, navigation: boolean) {
  const headers = page.locator('diffs-container').filter({
    has: page.getByRole('button', {
      name: 'Next file',
      exact: true,
      includeHidden: true,
    }),
  });
  const results: string[] = [];
  for (const header of await headers.all()) {
    const title = await header.locator('[data-title]').boundingBox();
    const card = await header.locator('[data-diffs-header]').boundingBox();
    const controls = [
      header.getByRole('button', { name: /^Comment on / }),
      ...(await header
        .locator('[data-deletions-count], [data-additions-count]')
        .all()),
    ];
    if (navigation)
      controls.push(
        header.getByRole('button', { name: 'Previous file', exact: true }),
        header.getByRole('button', { name: 'Next file', exact: true }),
      );
    for (const control of controls) {
      const box = await control.boundingBox();
      if (!title || !card || !box) results.push('Missing header geometry');
      else {
        const offset = Math.abs(
          title.y + title.height / 2 - box.y - box.height / 2,
        );
        if (offset > 1) results.push(`Center differs by ${offset}px`);
        if (
          navigation &&
          (box.x < card.x || box.x + box.width > card.x + card.width)
        )
          results.push(
            `Control outside header: ${box.x}..${box.x + box.width}, header ${card.x}..${card.x + card.width}`,
          );
      }
    }
  }
  return {
    files: await headers.count(),
    misaligned: results,
  };
}
