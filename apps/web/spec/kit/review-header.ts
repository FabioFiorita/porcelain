import type { Page } from '@playwright/test';

export async function reviewSliceHeaders(page: Page) {
  const slices = page.getByRole('region', { name: 'Code slices', exact: true });
  const headers = slices.getByRole('article').locator('header');
  const fitting = await headers.evaluateAll((nodes) =>
    nodes.every((node) => {
      const card = node.getBoundingClientRect();
      const controls = node.querySelectorAll('button, [role="checkbox"]');
      return [...controls].every((control) => {
        const box = control.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.left >= card.left &&
          box.right <= card.right &&
          box.top >= card.top &&
          box.bottom <= card.bottom
        );
      });
    }),
  );
  return {
    files: await headers.getByRole('button', { name: /^Open / }).count(),
    marks: await headers.getByRole('checkbox').count(),
    fitting,
  };
}
