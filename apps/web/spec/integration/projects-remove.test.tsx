import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'cancelling the removal of a project keeps it in the navigator and on the server at %i px',
  async (width, { render, server }) => {
    await browserPage.viewport(width, 896);
    try {
      const page = await render.navigator();

      const project = await server.project();
      const worktree = project.worktrees.find((entry) => entry.main);
      if (worktree === undefined)
        throw new Error('The project has no main worktree.');
      await page
        .getByRole('button', { name: 'Manage projects', exact: true })
        .click();
      const projectButton = page.getByRole('menuitem', {
        name: project.name,
        exact: true,
      });
      await expect.element(projectButton).toBeVisible();
      await projectButton.click();
      await page
        .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
        .click();
      const confirm = page.getByRole('alertdialog', {
        name: `Remove ${project.name} from Porcelain?`,
        exact: true,
      });
      await expect.element(confirm).toBeVisible();
      await expect
        .element(confirm)
        .toMatchTextContent(
          'Removes this project and its reviews and comments from Porcelain; files and Git history stay on disk.',
        );
      await expect.element(confirm).toMatchTextContent(worktree.path);
      await confirm
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();

      await expect.element(confirm).not.toBeInTheDocument();
      await page
        .getByRole('button', { name: 'Manage projects', exact: true })
        .click();
      await expect.element(projectButton).toBeVisible();
      await expect
        .poll(async () =>
          (await server.inventory()).projects.map((entry) => entry.id),
        )
        .toContain(project.id);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test.for([1280, 414])(
  'removing a project takes it out of the navigator and the server forgets it at %i px',
  async (width, { render, server }) => {
    await browserPage.viewport(width, 896);
    try {
      const page = await render.navigator();

      const project = await server.project();
      await page
        .getByRole('button', { name: 'Manage projects', exact: true })
        .click();
      const projectButton = page.getByRole('menuitem', {
        name: project.name,
        exact: true,
      });
      await projectButton.click();
      await page
        .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
        .click();
      const confirm = page.getByRole('alertdialog', {
        name: `Remove ${project.name} from Porcelain?`,
        exact: true,
      });
      await confirm
        .getByRole('button', { name: 'Remove from Porcelain', exact: true })
        .click();

      await expect.element(confirm).not.toBeInTheDocument();
      await expect
        .element(page.getByText('No projects registered', { exact: true }))
        .toBeVisible();
      await expect
        .poll(async () =>
          (await server.inventory()).projects.map((entry) => entry.id),
        )
        .not.toContain(project.id);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);
