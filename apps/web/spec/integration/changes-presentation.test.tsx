import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('Branch and Uncommitted keep the same reading width when switching the Changes comparison', async ({
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
      .element(page.getByText('Uncommitted local content.', { exact: true }))
      .toBeVisible();
    const content = page.getByRole('region', {
      name: 'Code content',
      exact: true,
    });
    const uncommitted = reviewLayout.codeContentEdges(content);
    await page
      .getByRole('toolbar', { name: 'Document controls', exact: true })
      .getByRole('tab', { name: 'Branch', exact: true })
      .click();
    await expect
      .element(
        page.getByRole('heading', { name: 'feature since main', exact: true }),
      )
      .toBeVisible();
    await expect
      .element(page.getByText('Committed branch content.', { exact: true }))
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
    await page
      .getByRole('toolbar', { name: 'Document controls', exact: true })
      .getByRole('tab', { name: 'Uncommitted', exact: true })
      .click();
    await expect
      .element(page.getByText('Uncommitted local content.', { exact: true }))
      .toBeVisible();
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
