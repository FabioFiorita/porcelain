import { expect, test } from './fixtures.tsx';

test('an edited file saves after a pause, with Done and when its tab closes', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const saved = async () => (await server.text(readme)).text;
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = workspace.getByRole('treeitem', { name: readme, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = workspace.getByRole('textbox', { name: readme, exact: true });
  await expect.element(editor).toBeVisible();

  await editor.fill('Browser autosave marker');
  await expect
    .element(workspace.getByText('Saved', { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toContain('Browser autosave marker');

  await editor.fill('Browser done marker');
  await workspace.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .element(workspace.getByRole('button', { name: 'Edit', exact: true }))
    .toBeVisible();
  await expect.poll(saved).toContain('Browser done marker');

  await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
  await workspace
    .getByRole('textbox', { name: readme, exact: true })
    .fill('Browser close marker');
  await workspace
    .getByRole('button', { name: `Close ${readme}`, exact: true })
    .last()
    .click();
  await expect.poll(saved).toContain('Browser close marker');
}, 30_000);
