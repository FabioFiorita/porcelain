import { expect, test } from './fixtures.ts';

test('a file is duplicated from its menu and the open copy again with Mod+D', async ({
  page,
  pairedPage,
  app,
  repo,
  server,
}) => {
  const project = (await server.project()).name;
  const path = 'notes.md';
  await repo.write(path, 'Notes to copy\n');
  const names = async () =>
    (await server.directory('')).entries.map((entry) => entry.name);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  await pairedPage
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Duplicate', exact: true })
    .click();
  await expect.poll(names).toContain('notes copy.md');
  await expect
    .poll(async () => (await server.text('notes copy.md')).text)
    .toBe('Notes to copy\n');
  await expect
    .poll(async () => (await server.text(path)).text)
    .toBe('Notes to copy\n');
  await expect.poll(() => app.title()).toBe(`notes copy.md — ${project}`);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect(
    pairedPage.getByRole('treeitem', { name: 'notes copy.md', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(names).toContain('notes copy copy.md');
  await expect.poll(() => app.title()).toBe(`notes copy copy.md — ${project}`);
});
