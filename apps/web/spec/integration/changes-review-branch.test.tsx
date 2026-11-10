import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'reviewing the branch lists the files committed since the default branch and opens the diff of one at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    try {
      await repo.branch('feature');
      await repo.switch('feature');
      await repo.write('notes.md', 'first line\nsecond line\n');
      await repo.commit('Add notes');
      await expect
        .poll(async () =>
          (await server.branchChanges()).files.map((file) => file.path),
        )
        .toEqual([repo.readme.path, 'notes.md']);

      const app = await render.route('/');
      const page = app.page;
      const search = () => new URL(app.location(), 'http://test').searchParams;
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      if (width === 414)
        await page
          .getByRole('complementary', {
            name: 'Review sidebar',
            exact: true,
          })
          .getByRole('tab', { name: 'Changes', exact: true })
          .click();
      else
        await page
          .getByRole('navigation', { name: 'Side panel', exact: true })
          .getByRole('button', { name: 'Changes', exact: true })
          .click();
      await page
        .getByRole('complementary', { name: 'Review sidebar', exact: true })
        .getByRole('tab', { name: 'Branch', exact: true })
        .click();
      await expect
        .element(
          page.getByText('1 commit on feature since main', { exact: true }),
        )
        .toBeVisible();
      await expect
        .element(
          page.getByRole('button', {
            name: 'README.md · modified',
            exact: true,
          }),
        )
        .toBeVisible();
      await page
        .getByRole('button', { name: 'notes.md · added', exact: true })
        .click();

      await expect
        .element(page.getByText('notes.md · on the branch', { exact: true }))
        .toBeVisible();
      await expect
        .element(page.getByText('second line', { exact: true }))
        .toBeVisible();

      await expect.poll(() => search().get('scope')).toBe('branch');
      await expect.poll(() => search().get('entry')).toBe('branch:notes.md');
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);
