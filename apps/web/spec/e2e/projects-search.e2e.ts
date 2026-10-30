import { expect, test } from './fixtures.ts';
import { replaceEditorContent } from '../kit/editor.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`sibling detached checkouts show distinct folder names through search and selection at ${width}px in ${colorScheme}`, async ({
      pairedPage,
      repo,
      server,
      app,
    }) => {
      await pairedPage.setViewportSize({ width, height: 896 });
      await pairedPage.emulateMedia({ colorScheme });
      const names = ['detached-531', 'detached-532'];
      for (const name of names) await repo.worktree(name);
      await expect
        .poll(async () => {
          const project = await server.project();
          return names.every((name) =>
            project.worktrees.some((row) => row.branch === name),
          );
        })
        .toBe(true);
      const project = await server.project();
      const computer = (await server.inventory()).environment.name;
      const targets = names.map((name) => {
        const worktree = project.worktrees.find((row) => row.branch === name);
        if (!worktree) throw new Error(`Missing checkout ${name}`);
        return worktree;
      });
      for (const name of names) await repo.detachWorktree(name);
      await app.reload();
      const sidebar = pairedPage.getByRole('navigation', {
        name: 'Projects and worktrees',
        exact: true,
      });
      const filter = sidebar.getByRole('button', {
        name: 'Filter reviews',
        exact: true,
      });
      if (width === 414)
        await pairedPage
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      for (const [index, target] of targets.entries()) {
        const row = sidebar.getByRole('button', {
          name: `${target.path} ${project.name}`,
          exact: true,
        });
        await expect(row).toBeVisible();
        const folder = row.getByText(names[index] ?? '', { exact: true });
        await expect(folder).toBeVisible();
        await expect
          .poll(() =>
            folder.evaluate((node) => node.scrollWidth <= node.clientWidth),
          )
          .toBe(true);
      }
      for (const [index, target] of targets.entries()) {
        const submenu = pairedPage.getByRole('menuitem', {
          name: 'Worktrees',
          exact: true,
        });
        if (index === 0) {
          await filter.focus();
          await filter.press('Enter');
          await pairedPage.keyboard.press('w');
          await expect(submenu).toBeFocused();
          await submenu.press('ArrowRight');
        } else {
          await filter.click();
          await submenu.click();
        }
        const result = pairedPage.getByRole('menuitemradio', {
          name: `${target.path} · ${project.name} ${computer}`,
          exact: true,
        });
        await expect(result).toBeVisible();
        await expect(result).toHaveCSS('height', '32px');
        const label = result.getByText(names[index] ?? '', { exact: true });
        await expect(label).toBeVisible();
        await expect
          .poll(() =>
            label.evaluate((node) => node.scrollWidth <= node.clientWidth),
          )
          .toBe(true);
        const search = pairedPage.getByRole('searchbox', {
          name: 'Search worktrees',
          exact: true,
        });
        await expect(search).toHaveValue('');
        await search.click();
        await search.fill('NO-MATCH');
        await expect(
          pairedPage.getByText('No matching worktrees', { exact: true }),
        ).toBeVisible();
        await search.press('ArrowDown');
        await expect(search).toBeFocused();
        await search.press('ArrowUp');
        await expect(search).toBeFocused();
        await search.fill(target.path);
        await expect(pairedPage.getByRole('menuitemradio')).toHaveCount(1);
        if (index === 0) {
          await search.press('ArrowDown');
          await expect(result).toBeFocused();
          await search.click();
          await search.press('ArrowUp');
          await expect(result).toBeFocused();
          await result.press('Enter');
        } else await result.click();
        await expect
          .poll(() => app.address().path)
          .toBe(`/${project.id}/${target.id}`);
        await expect(pairedPage.getByRole('menu')).toHaveCount(0);
        if (width === 414)
          await pairedPage
            .getByRole('button', { name: 'Toggle Sidebar', exact: true })
            .click();
        await filter.click();
        await pairedPage
          .getByRole('menuitem', { name: 'Worktrees', exact: true })
          .click();
        await expect(search).toHaveValue('');
        await expect(result).toHaveAttribute('aria-checked', 'true');
        await result.hover();
        await expect(pairedPage.getByRole('tooltip')).toHaveText(
          `${target.path} · ${project.name} · ${computer}`,
        );
        await result.click();
        await expect(pairedPage.getByRole('menu')).toHaveCount(0);
        if (width === 414)
          await pairedPage
            .getByRole('button', { name: 'Toggle Sidebar', exact: true })
            .click();
      }
    });
  }
}

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
  const target = project.worktrees.find((row) => row.branch === branch);
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
      (row) => row.branch === 'menu-dismissal',
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
    (row) => row.branch === 'other-workspace',
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
  await search.fill(current?.branch ?? 'missing');
  await pairedPage
    .getByRole('menuitemradio', {
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

test('No review keeps main and other checkouts reachable through search, filters and selection', async ({
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
  const meta = `${main.branch} ${project.name}`;
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('button', { name: 'Projects 1', exact: true }),
  ).not.toBeAttached();
  await expect(
    pairedPage.getByRole('button', { name: 'No review 2', exact: true }),
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
  ).not.toBeAttached();
  await expect(
    topicRow.getByText(inventory.environment.name, { exact: true }),
  ).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Search reviews and worktrees', exact: true })
    .click();
  const search = pairedPage.getByRole('searchbox', {
    name: 'Search reviews and worktrees',
    exact: true,
  });
  await search.fill(
    `${project.name} ${inventory.environment.name} ${main.branch}`,
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
  await repo.review('Group persistence fixture');
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
  const needsYou = sidebar.getByRole('button', {
    name: 'Needs you 1',
    exact: true,
  });
  const noReview = sidebar.getByRole('button', {
    name: 'No review 2',
    exact: true,
  });
  const topic = sidebar.getByRole('button', { name: /^collapsed-topic/ });
  await expect(
    sidebar.getByRole('button', {
      name: /^(Needs you \d|No review \d|Closed reviews$)/,
    }),
  ).toHaveText(['Needs you 1', 'No review 2', 'Closed 0']);
  await expect(needsYou).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar).toHaveCSS('background-color', 'rgb(243, 243, 244)');
  await expect(noReview).toHaveAttribute('aria-expanded', 'true');
  await needsYou.click();
  await expect(needsYou).toHaveAttribute('aria-expanded', 'false');
  await expect(topic).toBeVisible();
  await noReview.press('Enter');
  await expect(topic).not.toBeVisible();
  await sidebar
    .getByRole('button', { name: 'Search reviews and worktrees', exact: true })
    .click();
  const search = sidebar.getByRole('searchbox', {
    name: 'Search reviews and worktrees',
    exact: true,
  });
  await expect(search).toHaveAttribute('placeholder', 'Search');
  await search.fill('NO-MATCH');
  await search.fill('');
  await expect(needsYou).toHaveAttribute('aria-expanded', 'false');
  await sidebar.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(
    pairedPage.getByRole('heading', { name: 'General', exact: true }),
  ).toBeVisible();
  const settingsSidebar = pairedPage.getByRole('navigation', {
    name: 'Settings sections',
    exact: true,
  });
  await expect(settingsSidebar).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(needsYou).toHaveAttribute('aria-expanded', 'false');
  await expect(noReview).toHaveAttribute('aria-expanded', 'false');
  await pairedPage
    .getByRole('button', { name: 'Close Settings', exact: true })
    .click();
  await app.reload();
  await expect(needsYou).toHaveAttribute('aria-expanded', 'false');
  await expect(noReview).toHaveAttribute('aria-expanded', 'false');
  await noReview.click();
  await expect(topic).toBeVisible();
  await expect(needsYou).toHaveAttribute('aria-expanded', 'false');
});

test('review rows stay two lines with trailing progress and keyboard accessible reasons', async ({
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
  await expect(row).toHaveCSS('height', '49px');
  await expect(row).toHaveCSS('padding-top', '8px');
  await expect(row).toHaveCSS('padding-bottom', '8px');
  await expect(row.getByText('0/1', { exact: true })).toBeVisible();
  await expect(row.getByText('durable-review', { exact: true })).toBeVisible();
  await expect(
    row.getByText((await server.project()).name, { exact: true }),
  ).toBeVisible();
  await expect(
    row.getByText((await server.inventory()).environment.name, { exact: true }),
  ).not.toBeAttached();
  await expect(
    row.getByText('Proof failed', { exact: true }),
  ).not.toBeAttached();
  await expect(
    row.getByText('1 not explained', { exact: true }),
  ).not.toBeAttached();
  await expect(
    row.getByText('Agent says hold', { exact: true }),
  ).not.toBeAttached();
  const status = sidebar.getByRole('button', {
    name: 'Review status: Read one committed review after checkout cleanup',
    exact: true,
  });
  await row.focus();
  await pairedPage.keyboard.press('Shift+Tab');
  await expect(status).toBeFocused();
  await status.press('Enter');
  await expect(
    pairedPage.getByText('Proof failed', { exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByText('1 not explained', { exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByText('Agent says hold', { exact: true }),
  ).toBeVisible();
  await status.press('Escape');
  await expect(pairedPage.getByRole('tooltip')).toHaveCount(0);
  await expect(status).toBeFocused();
  const progress = row.getByLabel('0 of 1 decision reviewed', {
    exact: true,
  });
  await expect(progress).toHaveCSS('color', 'rgb(98, 98, 107)');
  await row.click();
  await expect(
    pairedPage.getByRole('heading', {
      name: 'Read one committed review after checkout cleanup 1 decision shapes this change.',
      exact: true,
    }),
  ).toBeVisible();
  await expect(progress).toHaveCSS('color', 'rgb(43, 95, 217)');
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

for (const { width, colorScheme } of [
  { width: 1440, colorScheme: 'light' as const },
  { width: 1440, colorScheme: 'dark' as const },
  { width: 414, colorScheme: 'light' as const },
  { width: 414, colorScheme: 'dark' as const },
]) {
  test(`sidebar chrome and touch reasons use stock controls at ${width}px in ${colorScheme}`, async ({
    pairedPage,
    repo,
    app,
    server,
    browser,
  }) => {
    await repo.review('Sidebar touch fixture');
    await repo.worktree(
      'no-review-with-a-very-long-branch-name-that-must-not-wrap',
    );
    const context = await browser.newContext({
      hasTouch: true,
      colorScheme,
      viewport: { width, height: 896 },
    });
    try {
      const page = await context.newPage();
      await page.goto(new URL(await app.link('this'), pairedPage.url()).href);
      const sidebar = page.getByRole('navigation', {
        name: 'Projects and worktrees',
        exact: true,
      });
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      await expect(sidebar).toBeVisible();
      const environment = (await server.inventory()).environment.name;
      await expect(
        sidebar.getByText(environment, { exact: true }),
      ).not.toBeAttached();
      const footer = sidebar.getByRole('group', {
        name: 'Navigator controls',
        exact: true,
      });
      await expect(
        footer.getByRole('button', { name: 'Computers', exact: true }),
      ).not.toBeAttached();
      const topic = page.getByRole('button', {
        name: /^no-review-with-a-very-long-branch/,
      });
      await expect(topic).toHaveCSS('height', width === 414 ? '40px' : '33px');
      await expect(topic).toHaveCSS('padding-top', '8px');
      await expect(topic).toHaveCSS('padding-bottom', '8px');
      await expect(
        topic.getByText(
          'no-review-with-a-very-long-branch-name-that-must-not-wrap',
          { exact: true },
        ),
      ).toHaveCount(1);
      await topic.click();
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      await expect(topic).toHaveAttribute('aria-current', 'page');
      await page.mouse.move(width - 1, 0);
      const searchToggle = sidebar.getByRole('button', {
        name: 'Search reviews and worktrees',
        exact: true,
      });
      if (await searchToggle.isVisible()) await searchToggle.tap();
      await sidebar
        .getByRole('searchbox', {
          name: 'Search reviews and worktrees',
          exact: true,
        })
        .focus();
      await expect(sidebar).toHaveCSS(
        'background-color',
        colorScheme === 'dark' ? 'rgb(11, 11, 12)' : 'rgb(243, 243, 244)',
      );
      const review = sidebar.getByRole('link', { name: /decisions? reviewed/ });
      const progress = review.getByLabel('0 of 1 decision reviewed', {
        exact: true,
      });
      await expect(progress).toHaveCSS(
        'color',
        colorScheme === 'dark' ? 'rgb(160, 160, 168)' : 'rgb(98, 98, 107)',
      );
      await sidebar
        .getByRole('button', { name: 'Filter reviews', exact: true })
        .click();
      await page
        .getByRole('menuitem', { name: 'Worktrees', exact: true })
        .click();
      await page.getByRole('menuitemradio', { name: /durable-review/ }).click();
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      await page.mouse.move(width - 1, 0);
      if (await searchToggle.isVisible()) await searchToggle.tap();
      await sidebar
        .getByRole('searchbox', {
          name: 'Search reviews and worktrees',
          exact: true,
        })
        .focus();
      await expect(review).toHaveAttribute('aria-current', 'page');
      await expect(progress).toHaveCSS(
        'color',
        colorScheme === 'dark' ? 'rgb(126, 164, 255)' : 'rgb(43, 95, 217)',
      );
      const status = sidebar.getByRole('button', {
        name: 'Review status: Read one committed review after checkout cleanup',
        exact: true,
      });
      const before = new URL(page.url()).pathname;
      await status.tap();
      await expect(status).toBeFocused();
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText('Proof failed');
      await expect(tooltip).toContainText('Agent says hold');
      await expect(status).toHaveAccessibleDescription(/Proof failed/);
      await expect.poll(() => new URL(page.url()).pathname).toBe(before);
      await footer
        .getByRole('button', { name: 'Keyboard shortcuts', exact: true })
        .tap();
      await expect(
        page.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      const settings = footer.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      await settings.focus();
      const settingsHint = page.getByRole('tooltip', { name: /^Settings/ });
      await expect(settingsHint).toContainText('Settings');
      await expect(settingsHint).toContainText('Shift');
      await settings.press('Enter');
      await expect(
        page.getByRole('heading', { name: 'General', exact: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
