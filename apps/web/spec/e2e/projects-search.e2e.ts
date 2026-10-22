import { expect, test } from './fixtures.ts';
import { replaceEditorContent } from '../kit/editor.ts';

test('the flat worktree menu searches checkouts without reviews and selects the exact workspace', async ({
  pairedPage,
  repo,
  server,
  app,
}) => {
  const original = app.address().path;
  const branch = 'search-target-with-a-long-branch-name-that-must-not-wrap';
  await repo.worktree(branch);
  await app.reload();
  const project = await server.project();
  const target = project.worktrees.find(
    (row) => row.branch === `refs/heads/${branch}`,
  );
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Worktrees', exact: true })
    .click();
  const selected = pairedPage.getByRole('menuitemradio', { checked: true });
  await expect(selected).toBeVisible();
  await expect(selected).not.toContainText('Current');
  const search = pairedPage.getByRole('searchbox', {
    name: 'Search worktrees',
    exact: true,
  });
  await search.click();
  await pairedPage.keyboard.type('NOT-A-WORKSPACE');
  await expect(search).toHaveValue('NOT-A-WORKSPACE');
  await expect(
    pairedPage.getByRole('menuitemradio', { name: /search-target/ }),
  ).not.toBeAttached();
  await expect.poll(() => app.address().path).toBe(original);
  await search.press('ControlOrMeta+a');
  await pairedPage.keyboard.type('search-');
  const result = pairedPage.getByRole('menuitemradio', {
    name: /search-target/,
  });
  await expect(result).toBeVisible();
  await expect(result).toHaveCSS('height', '32px');
  await result.hover();
  await pairedPage.keyboard.type('target');
  await expect(search).toHaveValue('search-target');
  await expect(search).toBeFocused();
  await pairedPage.keyboard.press('ArrowDown');
  await expect(result).toBeFocused();
  await pairedPage.keyboard.press('Enter');
  await expect
    .poll(() => app.address().path)
    .toBe(`/${project.id}/${target?.id ?? ''}`);
});

for (const width of [1280, 414]) {
  test(`worktree selection closes both menus at ${width}px, including reselection and navigation`, async ({
    pairedPage,
    repo,
    server,
    app,
  }) => {
    await expect
      .poll(() => new URLSearchParams(app.address().query).get('entry'))
      .toBe('handoff');
    await repo.worktree('menu-dismissal');
    await app.reload();
    await pairedPage.setViewportSize({ width, height: 896 });
    const project = await server.project();
    const target = project.worktrees.find(
      (row) => row.branch === 'refs/heads/menu-dismissal',
    );
    if (width === 414)
      await pairedPage
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
    const filter = pairedPage.getByRole('button', {
      name: 'Filter reviews',
      exact: true,
    });
    await filter.click();
    await pairedPage
      .getByRole('menuitem', { name: 'Worktrees', exact: true })
      .click();
    await pairedPage
      .getByRole('menuitemradio', { name: /menu-dismissal/ })
      .click();
    await expect
      .poll(() => app.address().path)
      .toBe(`/${project.id}/${target?.id ?? ''}`);
    await expect(pairedPage.getByRole('menu')).toHaveCount(0);
    if (width === 414)
      await pairedPage
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
    await filter.click();
    await pairedPage
      .getByRole('menuitem', { name: 'Worktrees', exact: true })
      .click();
    await pairedPage
      .getByRole('menuitemradio', { name: /menu-dismissal/, checked: true })
      .click();
    await expect(pairedPage.getByRole('menu')).toHaveCount(0);
    if (width === 414)
      await pairedPage
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
    await filter.click();
    await pairedPage
      .getByRole('menuitem', { name: 'Worktrees', exact: true })
      .click();
    await pairedPage
      .getByRole('searchbox', { name: 'Search worktrees', exact: true })
      .fill('menu-dismissal');
    const beforeBack = app.address();
    await pairedPage.goBack();
    await expect.poll(() => app.address()).not.toEqual(beforeBack);
    await expect(pairedPage.getByRole('menu')).toHaveCount(0);
    if (width === 414 && !(await filter.isVisible()))
      await pairedPage
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
    await filter.click();
    await pairedPage
      .getByRole('menuitem', { name: 'Worktrees', exact: true })
      .click();
    await expect(
      pairedPage.getByRole('searchbox', {
        name: 'Search worktrees',
        exact: true,
      }),
    ).toHaveValue('');
  });
}

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
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Worktrees', exact: true })
    .click();
  const search = pairedPage.getByRole('searchbox', {
    name: 'Search worktrees',
    exact: true,
  });
  await search.fill('other-workspace');
  await pairedPage
    .getByRole('menuitemradio', { name: /other-workspace/ })
    .click();
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
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Worktrees', exact: true })
    .click();
  await search.fill(current?.branch?.replace('refs/heads/', '') ?? 'missing');
  await pairedPage
    .getByRole('menuitemradio', {
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

test('Projects pins main checkouts, No review keeps other checkouts, and search and filters cover both', async ({
  pairedPage,
  repo,
  server,
  app,
}) => {
  await repo.worktree('status-topic');
  await app.reload();
  const project = await server.project();
  const inventory = await server.inventory();
  const main = project.worktrees.find((row) => row.main);
  const topic = project.worktrees.find((row) => !row.main);
  if (!main || !topic) throw new Error('Missing main or topic checkout');
  const meta = `${project.name} ${main.branch?.replace('refs/heads/', '')} ${inventory.environment.name}`;
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    pairedPage.getByText('Projects · 1', { exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByText('No review · 1', { exact: true }),
  ).toBeVisible();
  const mainRow = pairedPage.getByRole('button', { name: meta, exact: true });
  const topicRow = pairedPage.getByRole('button', { name: /^status-topic/ });
  await expect(mainRow).toBeVisible();
  await expect(topicRow).toBeVisible();
  await expect(topicRow.getByText(project.name, { exact: true })).toBeVisible();
  await expect(topicRow.getByText('status-topic', { exact: true })).toHaveCount(
    1,
  );
  await expect(
    mainRow.getByText(inventory.environment.name, { exact: true }),
  ).toBeVisible();
  await expect(
    topicRow.getByText(inventory.environment.name, { exact: true }),
  ).toBeVisible();
  const search = pairedPage.getByRole('searchbox', {
    name: 'Search reviews and worktrees',
    exact: true,
  });
  await search.fill(
    `${project.name} ${inventory.environment.name} ${main.branch?.replace('refs/heads/', '')}`,
  );
  await expect(mainRow).toBeVisible();
  await expect(topicRow).not.toBeAttached();
  await search.fill('');
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitemcheckbox', {
      name: inventory.environment.name,
      exact: true,
    })
    .click();
  await expect(mainRow).not.toBeAttached();
  await expect(topicRow).not.toBeAttached();
  await pairedPage
    .getByRole('menuitem', { name: 'Clear filters', exact: true })
    .click();
  await topicRow.click();
  await expect
    .poll(() => app.address().path)
    .toBe(`/${project.id}/${topic.id}`);
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await mainRow.click();
  await expect.poll(() => app.address().path).toBe(`/${project.id}/${main.id}`);
});

test('sidebar groups remember independent choices across search, Settings and reload with no duplicate footer navigation', async ({
  pairedPage,
  repo,
  app,
}) => {
  await repo.worktree('collapsed-topic');
  await app.reload();
  await pairedPage.setViewportSize({ width: 1280, height: 800 });
  const sidebar = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  await expect(
    sidebar.getByRole('heading', { name: 'Worktrees', exact: true }),
  ).not.toBeAttached();
  await expect(
    sidebar.getByRole('button', { name: 'Projects', exact: true }),
  ).not.toBeAttached();
  await expect(
    sidebar.getByRole('button', { name: 'Worktrees', exact: true }),
  ).not.toBeAttached();
  const projects = sidebar.getByRole('button', {
    name: 'Projects · 1',
    exact: true,
  });
  const noReview = sidebar.getByRole('button', {
    name: 'No review · 1',
    exact: true,
  });
  const topic = sidebar.getByRole('button', { name: /^collapsed-topic/ });
  await expect(projects).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar).toHaveCSS('background-color', 'oklch(1 0 0)');
  await expect(noReview).toHaveAttribute('aria-expanded', 'true');
  await projects.click();
  await expect(projects).toHaveAttribute('aria-expanded', 'false');
  await expect(topic).toBeVisible();
  await noReview.press('Enter');
  await expect(topic).not.toBeVisible();
  const search = sidebar.getByRole('searchbox', {
    name: 'Search reviews and worktrees',
    exact: true,
  });
  await expect(search).toHaveAttribute('placeholder', 'Search');
  await search.fill('NO-MATCH');
  await search.fill('');
  await expect(projects).toHaveAttribute('aria-expanded', 'false');
  await sidebar.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(
    pairedPage.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  const settingsSidebar = pairedPage.getByRole('navigation', {
    name: 'Settings sections',
    exact: true,
  });
  await expect(settingsSidebar).toHaveCSS('background-color', 'oklch(1 0 0)');
  await expect(settingsSidebar).toHaveCSS('border-top-left-radius', '14px');
  await pairedPage.getByRole('button', { name: 'Back', exact: true }).click();
  await app.reload();
  await expect(projects).toHaveAttribute('aria-expanded', 'false');
  await expect(noReview).toHaveAttribute('aria-expanded', 'false');
  await noReview.click();
  await expect(topic).toBeVisible();
  await expect(projects).toHaveAttribute('aria-expanded', 'false');
});

test('review rows stay two lines with trailing progress and tooltip-only reasons', async ({
  pairedPage,
  repo,
  app,
  server,
}) => {
  await repo.review('Compact review fixture');
  await app.reload();
  await pairedPage.setViewportSize({ width: 1280, height: 800 });
  const sidebar = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const row = sidebar.getByRole('link', {
    name: /Read one committed review after checkout cleanup/,
  });
  await expect(row).toHaveCSS('height', '48px');
  await expect(row.getByText('0/1', { exact: true })).toBeVisible();
  await expect(row.getByText('durable-review', { exact: true })).toBeVisible();
  await expect(
    row.getByText((await server.inventory()).environment.name, { exact: true }),
  ).toBeVisible();
  await expect(
    row.getByText('Proof failed', { exact: true }),
  ).not.toBeAttached();
  await expect(
    row.getByText('1 not explained', { exact: true }),
  ).not.toBeAttached();
  await expect(
    row.getByText('Agent says hold', { exact: true }),
  ).not.toBeAttached();
  await row.getByRole('img', { name: 'Review status', exact: true }).hover();
  await expect(
    pairedPage.getByText('Proof failed', { exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByText('1 not explained', { exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByText('Agent says hold', { exact: true }),
  ).toBeVisible();
  await row.click();
  await expect(
    pairedPage.getByRole('heading', {
      name: 'Read one committed review after checkout cleanup 1 decision shapes this change.',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('heading', {
      name: 'Recommendation: Hold',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('listitem', {
      name: 'Negative control: Failed',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    pairedPage.getByText('Not explained', { exact: true }).first(),
  ).toBeAttached();
});
