import { expect } from 'vitest';
import { test } from '../kit/journey';

test('an edited file saves after a pause, with Done and when its tab closes', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const saved = async () => (await server.text(readme)).text;
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  const file = pairedPage.getByRole('treeitem', { name: readme });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Open file' }).click();
  await pairedPage.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = pairedPage.getByRole('textbox', { name: readme });
  await expect.element(editor).toBeVisible();

  await editor.fill('Browser autosave marker');
  await expect
    .element(pairedPage.getByText('Saved', { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toContain('Browser autosave marker');

  await editor.fill('Browser done marker');
  await pairedPage.getByRole('button', { name: 'Done' }).click();
  await expect
    .element(pairedPage.getByRole('button', { name: 'Edit', exact: true }))
    .toBeVisible();
  await expect.poll(saved).toContain('Browser done marker');

  await pairedPage.getByRole('button', { name: 'Edit', exact: true }).click();
  await pairedPage
    .getByRole('textbox', { name: readme })
    .fill('Browser close marker');
  await pairedPage
    .getByRole('button', { name: `Close ${readme}` })
    .last()
    .click();
  await expect.poll(saved).toContain('Browser close marker');
});
