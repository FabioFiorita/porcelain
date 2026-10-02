import { expect, test } from './fixtures.tsx';

test('renaming a project in the navigator shows the new name and the server keeps it', async ({
  navigator,
  server,
}) => {
  const project = await server.project();
  const name = 'Browser renamed project';
  const projectButton = navigator.getByRole('button', {
    name: project.name,
    exact: true,
  });
  await expect.element(projectButton).toBeVisible();
  await projectButton.click({ button: 'right' });
  await navigator
    .getByRole('menuitem', { name: 'Rename project', exact: true })
    .click();
  await navigator.getByRole('textbox', { name: 'Name', exact: true }).fill(' ');
  await expect
    .element(navigator.getByRole('button', { name: 'Rename', exact: true }))
    .toBeDisabled();
  await expect.element(navigator.getByRole('alert')).toBeVisible();
  await navigator
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill(name);
  await navigator.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect
    .element(navigator.getByRole('button', { name, exact: true }))
    .toBeVisible();
  await expect.poll(async () => (await server.project()).name).toBe(name);
});
