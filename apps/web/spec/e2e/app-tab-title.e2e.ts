import { expect, test } from './fixtures.ts';

test('the browser tab follows the open surface, file and commit', async ({
  pairedPage,
  app,
  repo,
  server,
}, testInfo) => {
  const project = (await server.project()).name;
  const title = () => app.title();
  await expect.poll(title).toBe(`Changes — ${project}`);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  const sidebar = pairedPage.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  await expect(
    sidebar.getByRole('tablist').first().getByRole('tab'),
  ).toHaveText(['Files', 'Changes', 'History']);
  const files = sidebar.getByRole('tab', { name: 'Files', exact: true });
  const changes = sidebar.getByRole('tab', { name: 'Changes', exact: true });
  await expect(files).toHaveAttribute('aria-selected', 'true');
  await pairedPage.screenshot({ path: testInfo.outputPath('files-first.png') });
  await pairedPage.keyboard.press('Alt+2');
  await expect(changes).toHaveAttribute('aria-selected', 'true');
  await app.reload();
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(changes).toHaveAttribute('aria-selected', 'true');
  await pairedPage.keyboard.press('Alt+1');
  await expect(files).toHaveAttribute('aria-selected', 'true');
  const file = pairedPage.getByRole('treeitem', {
    name: repo.readme.path,
    exact: true,
  });
  await file.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await expect.poll(title).toBe(`${repo.readme.path} — ${project}`);

  const subject = 'Name the tab after the commit';
  await repo.commit(subject);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(subject);
  const oid = (await server.commits()).commits[0]?.oid ?? '';
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'History', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: new RegExp(`^${subject}`) })
    .click();
  await expect.poll(title).toBe(`${oid.slice(0, 7)} — ${project}`);
});
