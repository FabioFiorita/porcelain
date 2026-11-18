import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('All changes and the Branch document keep the same reading width', async ({
  repo,
  render,
  reviewLayout,
}) => {
  await browserPage.viewport(1600, 900);
  try {
    await repo.branch('feature');
    await repo.switch('feature');
    await repo.write('notes.md', 'Committed branch content.\n');
    await repo.commit('Add branch notes');
    await repo.write('notes.md', 'Uncommitted local content.\n');
    const app = await render.route('/');
    const page = app.page;
    await expect
      .element(page.getByRole('tab', { name: 'Review', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    const location = app.location().split('?')[0];
    await app.navigate(`${location}?entry=all-changes`);
    const content = page.getByRole('region', {
      name: 'Code content',
      exact: true,
    });
    await expect
      .element(content.getByText('Uncommitted local content.', { exact: true }))
      .toBeVisible();
    const uncommitted = reviewLayout.codeContentEdges(content);
    await app.navigate(`${location}?entry=branch`);
    await expect
      .element(
        page.getByRole('heading', { name: 'feature since main', exact: true }),
      )
      .toBeVisible();
    await expect
      .element(content.getByText('Committed branch content.', { exact: true }))
      .toBeVisible();
    await expect
      .poll(() => {
        const branch = reviewLayout.codeContentEdges(content);
        return Math.max(
          Math.abs(branch.left - uncommitted.left),
          Math.abs(branch.right - uncommitted.right),
        );
      })
      .toBeLessThanOrEqual(1);
  } finally {
    await browserPage.viewport(414, 896);
  }
});

test('loading a diff names the file and reserves code space below its header', async ({
  repo,
  render,
  fetchGate,
  reviewLayout,
}) => {
  const held = fetchGate.holdNextChangeDiff();
  held.arm();
  try {
    const app = await render.route('/');
    const page = app.page;
    await held.requested;
    const loading = page.getByRole('status', {
      name: 'Loading changes…',
      exact: true,
    });
    await expect.element(loading).toBeVisible();
    const filename = loading.getByText(repo.readme.path, { exact: true });
    await expect.element(filename).toBeVisible();
    const reservedHeight = reviewLayout.visibleHeight(loading);
    const filenameHeight = reviewLayout.visibleHeight(filename);
    await expect
      .poll(() => reservedHeight() - filenameHeight() * 4)
      .toBeGreaterThan(0);
    held.release();
    await expect
      .element(page.getByText('A change to review.', { exact: true }))
      .toBeVisible();
    await expect.element(loading).not.toBeInTheDocument();
  } finally {
    held.release();
  }
});
