import { page as browserPage } from 'vite-plus/test/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'a folder that is not a Git repository cannot be opened by browsing at %i px',
  async (width, { render, projectHome, server }) => {
    await browserPage.viewport(width, 896);
    try {
      const registered = async () =>
        (await server.inventory()).projects.flatMap((project) =>
          project.worktrees.map((worktree) => worktree.path),
        );
      const plain = await projectHome.folder('plain');
      const app = await render.route('/');
      const page = app.page;
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      await page
        .getByRole('button', { name: 'Open project', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Open project',
        exact: true,
      });
      await dialog.getByRole('button', { name: 'plain', exact: true }).click();
      await expect
        .element(dialog.getByText('No subfolders.', { exact: true }))
        .toBeVisible();
      await expect
        .element(
          dialog.getByText('Pick a folder that is a Git repository.', {
            exact: true,
          }),
        )
        .toBeVisible();
      await expect
        .element(
          dialog.getByRole('button', { name: 'Open plain', exact: true }),
        )
        .toBeDisabled();
      await expect.poll(registered).not.toContain(plain);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test('opening a new project from the phone sidebar closes the sidebar on its review', async ({
  render,
  projectHome,
  server,
}) => {
  const path = await projectHome.repository('fresh-repo');
  const app = await render.route('/');
  const page = app.page;
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Open project',
    exact: true,
  });
  await dialog.getByRole('button', { name: 'fresh-repo', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Open fresh-repo', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.inventory()).projects.flatMap((project) =>
        project.worktrees.map((worktree) => worktree.path),
      ),
    )
    .toContain(path);
  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('dialog', { name: 'Sidebar', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('tab', { name: 'Review', exact: true }))
    .toBeVisible();
});
