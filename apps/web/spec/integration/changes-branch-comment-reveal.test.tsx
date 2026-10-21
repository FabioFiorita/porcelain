import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'showing a branch comment opens its file against the base it was written against at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    try {
      await repo.branch('checkpoint');
      await repo.branch('feature');
      await repo.switch('feature');
      await repo.write('notes.md', 'first line\n');
      await repo.commit('Add notes');
      await expect
        .poll(async () => (await server.branchChanges()).commits)
        .toBe(1);

      const app = await render.route('/');
      const page = app.page;
      const search = () => new URL(app.location(), 'http://test').searchParams;
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Changes', exact: true }).click();
      await page.getByRole('tab', { name: 'Branch', exact: true }).click();
      await page
        .getByRole('button', {
          name: 'Compare against the default branch',
          exact: true,
        })
        .click();
      await page
        .getByRole('option', { name: 'checkpoint', exact: true })
        .click();
      await expect
        .poll(() => search().get('base'))
        .toBe('refs/heads/checkpoint');
      await page
        .getByRole('button', { name: 'notes.md · added', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Comment on notes.md (added)',
          exact: true,
        })
        .click();
      await page
        .getByRole('textbox', { name: 'Comment', exact: true })
        .fill('Against the checkpoint');
      await page.getByRole('button', { name: 'Comment', exact: true }).click();
      await expect
        .poll(async () =>
          (await server.commentThreads()).map(
            (thread) => thread.anchor.comparison,
          ),
        )
        .toEqual([{ kind: 'branch', base: 'refs/heads/checkpoint' }]);

      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Changes', exact: true }).click();
      await page
        .getByRole('button', {
          name: 'Compare against checkpoint',
          exact: true,
        })
        .click();
      await page.getByRole('option', { name: /^main/u }).click();
      await expect.poll(() => search().get('base')).toBeNull();

      await page.getByRole('tab', { name: /^Comments/u }).click();
      await page
        .getByRole('button', { name: /^notes\.md Whole file/u })
        .click();
      await expect
        .poll(() => search().get('base'))
        .toBe('refs/heads/checkpoint');
      await expect.poll(() => search().get('entry')).toBe('branch:notes.md');
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);
