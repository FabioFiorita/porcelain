import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a branch mark belongs to its branch: another branch starts fresh and switching back finds it', async ({
  workspace,
  repo,
  server,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'first line\n');
  await repo.commit('Add notes');
  await expect
    .poll(async () => (await server.branchChanges()).head.branch)
    .toBe('refs/heads/feature');

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Branch', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'notes.md · added', exact: true })
    .click();
  await workspace
    .getByRole('button', { name: 'Mark notes.md as reviewed', exact: true })
    .first()
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedFiles('refs/heads/feature')).marks.map(
        (mark) => mark.path,
      ),
    )
    .toEqual(['notes.md']);

  await repo.branch('copy');
  await repo.switch('copy');
  await expect
    .element(
      workspace
        .getByRole('button', { name: 'Mark notes.md as reviewed', exact: true })
        .first(),
    )
    .toBeVisible();

  await repo.switch('feature');
  await expect
    .element(
      workspace
        .getByRole('button', {
          name: 'Unmark notes.md as unreviewed',
          exact: true,
        })
        .first(),
    )
    .toBeVisible();
});

test.for([1280, 414])(
  'marking a branch file reviewed keeps the mark in the branch review only at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    try {
      await repo.branch('feature');
      await repo.switch('feature');
      await repo.write('notes.md', 'first line\nsecond line\n');
      await repo.commit('Add notes');
      const app = await render.route('/');
      const page = app.page;
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Changes', exact: true }).click();
      await page.getByRole('tab', { name: 'Branch', exact: true }).click();
      await page
        .getByRole('button', { name: 'notes.md · added', exact: true })
        .click();
      await expect
        .element(page.getByText('second line', { exact: true }))
        .toBeVisible();
      const branchMarks = async () =>
        (await server.reviewedFiles('refs/heads/feature')).marks.map(
          (mark) => mark.path,
        );
      await page
        .getByRole('button', { name: 'Mark notes.md as reviewed', exact: true })
        .first()
        .click();
      await expect.poll(branchMarks).toEqual(['notes.md']);
      await expect
        .element(
          page
            .getByRole('button', {
              name: 'Unmark notes.md as unreviewed',
              exact: true,
            })
            .first(),
        )
        .toBeEnabled();
      await expect
        .poll(async () => (await server.reviewedFiles()).marks)
        .toEqual([]);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);
