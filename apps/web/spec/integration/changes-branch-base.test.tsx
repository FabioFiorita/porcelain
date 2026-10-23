import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'choosing another base compares the branch against it and the default brings the default comparison back at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    try {
      await repo.branch('feature');
      await repo.switch('feature');
      await repo.write('first.md', 'first\n');
      await repo.commit('First on the branch');
      await repo.branch('checkpoint');
      await repo.write('second.md', 'second\n');
      await repo.commit('Second on the branch');
      await expect
        .poll(async () => (await server.branchChanges()).commits)
        .toBe(2);

      const app = await render.route('/');
      const page = app.page;
      if (width === 414)
        await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page
        .getByRole('complementary', { name: 'Review sidebar', exact: true })
        .getByRole('tab', { name: 'Changes', exact: true })
        .click();
      await page.getByRole('tab', { name: 'Branch', exact: true }).click();
      await expect
        .element(
          page.getByText('2 commits on feature since main', { exact: true }),
        )
        .toBeVisible();

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
        .element(
          page.getByText('1 commit on feature since checkpoint', {
            exact: true,
          }),
        )
        .toBeVisible();
      await expect
        .element(
          page.getByRole('button', {
            name: 'second.md · added',
            exact: true,
          }),
        )
        .toBeVisible();
      await expect
        .element(
          page.getByRole('button', { name: 'first.md · added', exact: true }),
        )
        .not.toBeInTheDocument();
      const base = () =>
        new URL(app.location(), 'http://test').searchParams.get('base');
      await expect.poll(base).toBe('refs/heads/checkpoint');

      await page
        .getByRole('button', {
          name: 'Compare against checkpoint',
          exact: true,
        })
        .click();
      await page.getByRole('option', { name: /^main/u }).click();
      await expect
        .element(
          page.getByText('2 commits on feature since main', { exact: true }),
        )
        .toBeVisible();
      await expect.poll(base).toBeNull();
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);
