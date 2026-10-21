import { expect, test } from './fixtures.ts';
import { replaceEditorContent } from '../kit/editor.ts';

test('the flat worktree menu searches checkouts without reviews and selects the exact workspace', async ({
  pairedPage,
  repo,
  server,
  app,
}) => {
  const original = app.address().path;
  await repo.worktree('search-target');
  await app.reload();
  const project = await server.project();
  const target = project.worktrees.find(
    (row) => row.branch === 'refs/heads/search-target',
  );
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Worktrees', exact: true })
    .click();
  const search = pairedPage.getByRole('searchbox', {
    name: 'Search worktrees',
    exact: true,
  });
  await search.fill('NOT-A-WORKSPACE');
  await expect(
    pairedPage.getByRole('menuitem', { name: /search-target/ }),
  ).not.toBeAttached();
  await expect.poll(() => app.address().path).toBe(original);
  await search.fill('search-target');
  const result = pairedPage.getByRole('menuitem', { name: /search-target/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect
    .poll(() => app.address().path)
    .toBe(`/${project.id}/${target?.id ?? ''}`);
});

test('selecting a search result keeps a conflicted unsaved draft when returning to its workspace', async ({
  pairedPage,
  repo,
  server,
  app,
}) => {
  await repo.worktree('other-workspace');
  await app.reload();
  const project = await server.project();
  const original = app.address().path;
  const current = project.worktrees.find((row) =>
    original.endsWith(`/${row.id}`),
  );
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  await pairedPage
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await pairedPage.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = pairedPage.getByRole('textbox', {
    name: repo.readme.path,
    exact: true,
  });
  await expect(editor).toBeVisible();
  await repo.write(repo.readme.path, 'Independent disk change\n');
  await replaceEditorContent(
    editor,
    'Keep this unsaved draft across workspace search',
  );
  await expect(
    pairedPage.getByText('Not saving: changed on disk', { exact: true }),
  ).toBeVisible();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Worktrees', exact: true })
    .click();
  const search = pairedPage.getByRole('searchbox', {
    name: 'Search worktrees',
    exact: true,
  });
  await search.fill('other-workspace');
  await pairedPage.getByRole('menuitem', { name: /other-workspace/ }).click();
  const other = project.worktrees.find(
    (row) => row.branch === 'refs/heads/other-workspace',
  );
  await expect
    .poll(() => app.address().path)
    .toBe(`/${project.id}/${other?.id ?? ''}`);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Worktrees', exact: true })
    .click();
  await search.fill(current?.branch?.replace('refs/heads/', '') ?? 'missing');
  await pairedPage
    .getByRole('menuitem', {
      name: new RegExp(
        current?.branch?.replace('refs/heads/', '') ?? 'missing',
      ),
    })
    .click();
  await expect.poll(() => app.address().path).toBe(original);
  const resume = pairedPage.getByRole('button', {
    name: 'Resume edit',
    exact: true,
  });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(editor).toHaveText(
    'Keep this unsaved draft across workspace search',
  );
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe('Independent disk change\n');
});
