import { expect, test } from './fixtures.ts';
import { replaceEditorContent } from '../kit/editor.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`project cards distinguish detached worktrees and disclose computer identity at ${width}px in ${colorScheme}`, async ({
      pairedPage: page,
      repo,
      server,
      app,
    }) => {
      await page.setViewportSize({ width, height: 896 });
      await page.emulateMedia({ colorScheme });
      for (const name of ['detached-531', 'detached-532']) {
        await repo.worktree(name);
        await repo.detachWorktree(name);
      }
      await app.reload();
      const project = await server.project();
      const inventory = await server.inventory();
      const environment = inventory.environment;
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      const sidebar = page.getByRole('navigation', {
        name: 'Projects and worktrees',
        exact: true,
      });
      const computer = sidebar.getByRole('button', {
        name: `Computer: ${environment.name}`,
        exact: true,
      });
      await expect(computer).toBeVisible();
      await computer.focus();
      await computer.press('Enter');
      await expect(
        page.getByText(`Environment ${inventory.environmentId}`, {
          exact: true,
        }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      const cards = sidebar.getByRole('listitem');
      await expect(cards.first()).toContainText('Main worktree');
      for (const folder of ['detached-531', 'detached-532']) {
        const target = project.worktrees.find((row) =>
          row.path.endsWith(`/${folder}`),
        );
        if (!target) throw new Error(`Missing ${folder}`);
        const row = sidebar.getByRole('button', {
          name: new RegExp(`${folder}.*Detached HEAD`),
        });
        await expect(row).toBeVisible();
        await expect(row.getByText(folder, { exact: true })).toBeVisible();
        await row.click();
        await expect
          .poll(() => app.address().path)
          .toBe(`/${project.id}/${target.id}`);
        if (width === 414)
          await page
            .getByRole('button', { name: 'Toggle Sidebar', exact: true })
            .click();
        await expect(row).toHaveAttribute('aria-current', 'page');
      }
      await sidebar
        .getByRole('button', {
          name: 'Search reviews and worktrees',
          exact: true,
        })
        .click();
      const search = sidebar.getByRole('searchbox', {
        name: 'Search reviews and worktrees',
        exact: true,
      });
      await search.fill('NO-MATCH');
      await expect(
        sidebar.getByText('No matching worktrees', { exact: true }),
      ).toBeVisible();
      await search.press('ArrowDown');
      await expect(search).toBeFocused();
      await search.fill('detached-532');
      await search.press('ArrowDown');
      await expect(
        sidebar.getByRole('button', { name: /detached-532.*Detached HEAD/ }),
      ).toBeFocused();
    });
  }
}

test('search reveals a collapsed project without replacing its session choice and filtering preserves project management', async ({
  pairedPage: page,
  repo,
  server,
  app,
}) => {
  await repo.worktree('collapsed-topic');
  await app.reload();
  await page.setViewportSize({ width: 1440, height: 896 });
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const projectToggle = sidebar.getByRole('button', {
    name: `${project.name} · ${computer}`,
    exact: true,
  });
  const topic = sidebar.getByRole('button', { name: /^collapsed-topic,/ });
  await projectToggle.click();
  await expect(projectToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(topic).not.toBeVisible();
  await sidebar
    .getByRole('button', { name: 'Search reviews and worktrees', exact: true })
    .click();
  const search = sidebar.getByRole('searchbox', {
    name: 'Search reviews and worktrees',
    exact: true,
  });
  await search.fill('collapsed-topic');
  await expect(topic).toBeVisible();
  await search.fill('');
  await expect(projectToggle).toHaveAttribute('aria-expanded', 'false');
  await sidebar.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Close Settings', exact: true })
    .click();
  await expect(projectToggle).toHaveAttribute('aria-expanded', 'false');
  await projectToggle.press('Enter');
  await expect(topic).toBeVisible();
  await sidebar
    .getByRole('button', { name: 'Filter worktrees', exact: true })
    .click();
  await page
    .getByRole('menuitemcheckbox', { name: computer, exact: true })
    .click();
  await expect(topic).not.toBeAttached();
  await page
    .getByRole('menuitem', { name: 'Clear filters', exact: true })
    .click();
  await expect(topic).toBeVisible();
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
    .getByRole('button', { name: 'Search reviews and worktrees', exact: true })
    .click();
  const search = pairedPage.getByRole('searchbox', {
    name: 'Search reviews and worktrees',
    exact: true,
  });
  await search.fill('other-workspace');
  await pairedPage.getByRole('button', { name: /other-workspace/ }).click();
  const other = project.worktrees.find(
    (row) => row.branch === 'other-workspace',
  );
  await expect
    .poll(() => app.address().path)
    .toBe(`/${project.id}/${other?.id ?? ''}`);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(search).toHaveValue('other-workspace');
  await search.fill(current?.branch ?? 'missing');
  await pairedPage
    .getByRole('button', {
      name: new RegExp(current?.branch ?? 'missing'),
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
