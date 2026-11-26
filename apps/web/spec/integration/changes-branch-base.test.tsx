import { page as browserPage, userEvent } from 'vite-plus/test/browser';
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
      if (width === 414) {
        await page
          .getByRole('button', { name: 'Side panel', exact: true })
          .click();
        await page
          .getByRole('complementary', { name: 'Review sidebar', exact: true })
          .getByRole('tab', { name: 'Changes', exact: true })
          .click();
      } else
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
          page.getByText('2 commits on feature since main', { exact: true }),
        )
        .toBeVisible();

      await page
        .getByRole('complementary', { name: 'Review sidebar', exact: true })
        .getByRole('button', {
          name: 'Compare against main',
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
        .getByRole('complementary', { name: 'Review sidebar', exact: true })
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

test('the base picker lists the best fuzzy matches first', async ({
  render,
  repo,
}) => {
  await browserPage.viewport(1280, 896);
  try {
    for (const name of [
      'chore/merge-main',
      'docs/readme-main',
      'feat/search-ranking',
      'feature/note-search',
      'feature/notes-archive',
      'fix/search-empty',
      'mainline-sync',
      'release/main-2026',
      'spike/menu-a11y',
    ])
      await repo.branch(name);
    const app = await render.route('/');
    const page = app.page;
    await page
      .getByRole('navigation', { name: 'Side panel', exact: true })
      .getByRole('button', { name: 'Changes', exact: true })
      .click();
    await page
      .getByRole('complementary', { name: 'Review sidebar', exact: true })
      .getByRole('tab', { name: 'Branch', exact: true })
      .click();
    await page
      .getByRole('complementary', { name: 'Review sidebar', exact: true })
      .getByRole('button', { name: /^Compare against / })
      .click();
    const search = page.getByRole('combobox', {
      name: 'Find a base branch',
      exact: true,
    });
    const options = page
      .getByRole('listbox', { name: 'Base branches', exact: true })
      .getByRole('option');
    for (const [query, order] of [
      [
        'sea',
        [
          'fix/search-empty',
          'feat/search-ranking',
          'feature/note-search',
          'spike/menu-a11y',
          'docs/readme-main',
          'release/main-2026',
        ],
      ],
      [
        'fsr',
        [
          'feat/search-ranking',
          'feature/note-search',
          'fix/search-empty',
          'feature/notes-archive',
        ],
      ],
      [
        'mn',
        [
          'chore/merge-main',
          'main default',
          'mainline-sync',
          'release/main-2026',
          'spike/menu-a11y',
          'docs/readme-main',
        ],
      ],
    ] as const) {
      await search.fill(query);
      for (const [index, name] of order.entries())
        await expect.element(options.nth(index)).toHaveAccessibleName(name);
      await expect.element(options.nth(order.length)).not.toBeInTheDocument();
    }
  } finally {
    await browserPage.viewport(414, 896);
  }
});

test('a clipped base name still shows its tooltip on keyboard focus after the pointer hovered and left it', async ({
  render,
  repo,
  reviewLayout,
}) => {
  await browserPage.viewport(1280, 896);
  try {
    const base = `release/${'long-base-branch-name-'.repeat(4)}end`;
    await repo.branch(base);
    const app = await render.route('/');
    const page = app.page;
    await page
      .getByRole('navigation', { name: 'Side panel', exact: true })
      .getByRole('button', { name: 'Changes', exact: true })
      .click();
    const sidebar = page.getByRole('complementary', {
      name: 'Review sidebar',
      exact: true,
    });
    await sidebar.getByRole('tab', { name: 'Branch', exact: true }).click();
    await sidebar
      .getByRole('button', { name: 'Compare against main', exact: true })
      .click();
    await page.getByRole('option', { name: base, exact: true }).click();
    const compare = sidebar.getByRole('button', {
      name: `Compare against ${base}`,
      exact: true,
    });
    const tooltip = page
      .getByRole('tooltip')
      .filter({ hasText: `Against ${base}` });
    await compare.hover();
    await expect.element(tooltip).toBeVisible();
    await sidebar.getByRole('tab', { name: 'Branch', exact: true }).hover();
    await expect.element(tooltip).not.toBeInTheDocument();
    reviewLayout.focus(
      sidebar.getByRole('tab', { name: 'Branch', exact: true }),
    );
    await userEvent.keyboard('{Tab}');
    await expect.element(compare).toHaveFocus();
    await expect.element(tooltip).toBeVisible();
  } finally {
    await browserPage.viewport(414, 896);
  }
});
