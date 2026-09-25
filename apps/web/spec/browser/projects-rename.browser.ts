import { expect } from 'vitest';
import { test } from '../kit/journey';

test('renaming a project in the navigator shows the new name and the server keeps it', async ({
  pairedPage,
  server,
}) => {
  const project = await server.project();
  const name = 'Browser renamed project';
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await expect
    .element(
      pairedPage.getByRole('navigation', { name: 'Projects and worktrees' }),
    )
    .toBeVisible();
  const projectButton = pairedPage.getByRole('button', {
    name: project.name,
    exact: true,
  });
  await expect.element(projectButton).toBeVisible();
  await projectButton.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Rename project' }).click();
  await pairedPage.getByRole('textbox', { name: 'Name' }).fill(name);
  await pairedPage.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect
    .element(pairedPage.getByRole('button', { name, exact: true }))
    .toBeVisible();
  await expect.poll(async () => (await server.project()).name).toBe(name);
});
