import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

test('projects.rename: a renamed project persists on the server', async () => {
  const code: unknown = import.meta.env.VITE_WEB_PROJECTS_RENAME_CODE;
  const environmentId: unknown = import.meta.env.VITE_WEB_ENVIRONMENT_ID;
  if (typeof code !== 'string' || typeof environmentId !== 'string')
    throw new Error('Browser verification did not issue a pairing link');
  const fragment = new URLSearchParams({ c: code, e: environmentId });
  history.replaceState({}, '', `/pair#${fragment.toString()}`);
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);

  await import('../../src/main.tsx');
  await expect
    .element(page.getByRole('region', { name: 'Review content' }))
    .toBeVisible();
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await expect
    .element(page.getByRole('navigation', { name: 'Projects and worktrees' }))
    .toBeVisible();
  const originalResponse = await fetch('/api/inventory', { cache: 'no-store' });
  expect(originalResponse.status).toBe(200);
  const original = readInventoryResponseSchema.parse(
    await originalResponse.json(),
  );
  const project = original.projects[0];
  if (!project) throw new Error('The isolated server has no project');

  const projectButton = page.getByRole('button', {
    name: project.name,
    exact: true,
  });
  await expect.element(projectButton).toBeVisible();
  await projectButton.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename project' }).click();
  const name = 'Browser renamed project';
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect
    .element(page.getByRole('button', { name, exact: true }))
    .toBeVisible();

  const savedResponse = await fetch('/api/inventory', { cache: 'no-store' });
  expect(savedResponse.status).toBe(200);
  const saved = readInventoryResponseSchema.parse(await savedResponse.json());
  expect(saved.projects.find((entry) => entry.id === project.id)?.name).toBe(
    name,
  );
});
