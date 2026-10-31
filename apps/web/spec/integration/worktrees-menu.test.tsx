import { page as browserPage, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('inventory cards remain useful before a review is published and name their computer', async ({
  navigator,
  server,
}) => {
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  await expect
    .element(
      navigator.getByRole('img', {
        name: `Computer: ${computer}`,
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      navigator.getByRole('button', {
        name: new RegExp(`, ${project.name},.*Main worktree`),
      }),
    )
    .toBeVisible();
  await navigator
    .getByRole('button', { name: 'Filter worktrees', exact: true })
    .click();
  await expect
    .element(
      navigator.getByRole('menuitemcheckbox', {
        name: 'Show older reviews',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-checked', 'false');
});

for (const width of [1440, 414]) {
  test(`search Escape restores cards while keeping the field focused at ${width}px`, async ({
    navigator,
    server,
  }) => {
    await browserPage.viewport(width, 896);
    try {
      const project = await server.project();
      const main = navigator.getByRole('button', {
        name: new RegExp(`, ${project.name},.*Main worktree`),
      });
      const search = navigator.getByRole('searchbox', {
        name: 'Search reviews and worktrees',
        exact: true,
      });
      await expect.element(search).toBeVisible();
      await search.fill('NO-MATCH');
      await expect.element(main).not.toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await expect.element(search).toHaveValue('');
      await expect.element(main).toBeVisible();
      await expect.element(search).toHaveFocus();
    } finally {
      await browserPage.viewport(414, 896);
    }
  });
}
