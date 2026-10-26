import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('renaming a project in the navigator shows the new name and the server keeps it', async ({
  navigator,
  server,
}) => {
  const project = await server.project();
  const name = 'Browser renamed project';
  await navigator
    .getByRole('button', { name: 'Manage projects', exact: true })
    .click();
  const projectButton = navigator.getByRole('menuitem', {
    name: project.name,
    exact: true,
  });
  await expect.element(projectButton).toBeVisible();
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(projectButton).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}{ArrowDown}');
  await expect
    .element(
      navigator.getByRole('menuitem', { name: 'Rename project', exact: true }),
    )
    .toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await navigator.getByRole('textbox', { name: 'Name', exact: true }).fill(' ');
  await expect
    .element(navigator.getByRole('button', { name: 'Rename', exact: true }))
    .toBeDisabled();
  await expect.element(navigator.getByRole('alert')).toBeVisible();
  await navigator
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill(name);
  await navigator.getByRole('button', { name: 'Rename', exact: true }).click();
  await navigator
    .getByRole('button', { name: 'Manage projects', exact: true })
    .click();
  await expect
    .element(navigator.getByRole('menuitem', { name, exact: true }))
    .toBeVisible();
  await expect.poll(async () => (await server.project()).name).toBe(name);
});
