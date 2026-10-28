import { page as browserPage, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('worktrees without reviews remain reachable in the flat checkout menu', async ({
  navigator,
  server,
}) => {
  const closed = navigator.getByRole('button', {
    name: 'Closed reviews',
    exact: true,
  });
  await expect.element(closed).toHaveTextContent('Closed 0');
  await expect.element(closed).toHaveAttribute('aria-expanded', 'false');
  await closed.click();
  await expect
    .element(navigator.getByText('No closed reviews', { exact: true }))
    .toBeVisible();
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  const main = navigator.getByRole('button', {
    name: new RegExp(project.name),
  });
  await expect.element(main).toBeVisible();
  await expect.element(closed).toHaveAttribute('aria-expanded', 'true');
  await closed.click();
  await expect
    .element(main.getByText(computer, { exact: true }))
    .not.toBeInTheDocument();
  await navigator
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await navigator
    .getByRole('menuitem', { name: 'Worktrees', exact: true })
    .click();
  await expect
    .element(
      navigator.getByRole('menuitemradio', { name: new RegExp(project.name) }),
    )
    .toBeVisible();
  await expect
    .element(
      navigator
        .getByRole('menuitemradio', { name: new RegExp(project.name) })
        .getByText(computer, { exact: true }),
    )
    .toBeVisible();
  await navigator
    .getByRole('searchbox', { name: 'Search worktrees', exact: true })
    .fill('NO-MATCH');
  await expect
    .element(
      navigator.getByRole('menuitemradio', { name: new RegExp(project.name) }),
    )
    .not.toBeInTheDocument();
});

test.for([1280, 414])(
  'the checkout menu has a temporary search independent of sidebar search and Closed at %i px',
  async (width, { render, repo }) => {
    await browserPage.viewport(width, 896);
    try {
      await repo.worktree('independent-search');

      const page = await render.navigator();
      await page
        .getByRole('button', {
          name: 'Search reviews and worktrees',
          exact: true,
        })
        .click();
      const sidebarSearch = page.getByRole('searchbox', {
        name: 'Search reviews and worktrees',
        exact: true,
      });
      await sidebarSearch.fill('NO-SIDEBAR-MATCH');
      await page
        .getByRole('button', { name: 'Closed reviews', exact: true })
        .click();
      await expect
        .element(page.getByText('No matching closed reviews', { exact: true }))
        .toBeVisible();
      const menu = page.getByRole('menuitem', {
        name: 'Worktrees',
        exact: true,
      });
      await page
        .getByRole('button', { name: 'Filter reviews', exact: true })
        .click();
      await menu.click();
      const search = page.getByRole('searchbox', {
        name: 'Search worktrees',
        exact: true,
      });
      await expect.element(search).toHaveValue('');
      await expect
        .element(
          page.getByRole('menuitemradio', { name: /independent-search/ }),
        )
        .toBeVisible();
      await search.click();
      await userEvent.type(search, 'independent-search');
      await expect.element(search).toHaveValue('independent-search');
      await expect.element(search).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      await expect.element(search).not.toBeInTheDocument();
      await expect.element(sidebarSearch).toHaveValue('NO-SIDEBAR-MATCH');
      await menu.click();
      await expect.element(search).toHaveValue('');
      await userEvent.keyboard('{Escape}');
      await userEvent.keyboard('{Escape}');
      await page
        .getByRole('button', { name: 'Closed reviews', exact: true })
        .click();
      await expect.element(sidebarSearch).toHaveValue('NO-SIDEBAR-MATCH');
      await expect
        .element(page.getByText('No matching worktrees', { exact: true }))
        .toBeVisible();
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test.for([1440, 414])(
  'search opens in the filter row and Escape clears it and returns focus at %i px',
  async (width, { navigator, server }) => {
    await browserPage.viewport(width, 896);
    try {
      const project = await server.project();
      const main = navigator.getByRole('button', {
        name: new RegExp(project.name),
      });
      const search = navigator.getByRole('searchbox', {
        name: 'Search reviews and worktrees',
        exact: true,
      });
      await expect.element(search).not.toBeInTheDocument();
      await navigator
        .getByRole('button', {
          name: 'Search reviews and worktrees',
          exact: true,
        })
        .click();
      await expect.element(search).toHaveFocus();
      await search.fill('NO-MATCH');
      await expect.element(main).not.toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await expect.element(search).not.toBeInTheDocument();
      await expect.element(main).toBeVisible();
      await expect
        .element(
          navigator.getByRole('button', {
            name: 'Search reviews and worktrees',
            exact: true,
          }),
        )
        .toHaveFocus();
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);
