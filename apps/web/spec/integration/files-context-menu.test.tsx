import { userEvent } from 'vitest/browser';
import { expect, expectInputFocus, test } from './fixtures.tsx';

test.for([1280, 414])(
  'a second right-click on another row opens that row’s menu at %ipx',
  async (width, { render, repo, agent, server }) => {
    await agent.editFile({
      kind: 'create',
      path: 'alpha',
      entryKind: 'directory',
    });
    await agent.editFile({
      kind: 'create',
      path: 'beta',
      entryKind: 'directory',
    });
    await repo.write('alpha/first.md', 'First folder\n');
    await repo.write('beta/second.md', 'Second folder\n');
    await repo.write('guide.md', 'Guide\n');
    for (let index = 0; index < 40; index++)
      await repo.write(`row-${String(index).padStart(2, '0')}.md`, 'Row\n');
    const last = 'z-last-with-a-long-name-that-still-needs-the-correct-menu.md';
    await repo.write(last, 'Last row\n');
    const page = await render.workspace();
    await page.viewport(width, 896);
    if (width === 414) {
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Files', exact: true }).click();
    } else
      await page
        .getByRole('navigation', { name: 'Side panel', exact: true })
        .getByRole('button', { name: 'Files', exact: true })
        .click();
    const row = (name: string) =>
      page.getByRole('treeitem', { name, exact: true, includeHidden: true });
    const menu = (path: string) =>
      page.getByRole('menu', { name: `${path} actions`, exact: true });

    for (const [first, firstPath, second, secondPath] of [
      ['alpha', 'alpha/', 'beta', 'beta/'],
      ['guide.md', 'guide.md', 'README.md', 'README.md'],
      ['alpha', 'alpha/', 'guide.md', 'guide.md'],
      ['guide.md', 'guide.md', 'beta', 'beta/'],
      ['beta', 'beta/', 'beta', 'beta/'],
    ] as const) {
      await row(first).click({ button: 'right' });
      await expect.element(menu(firstPath)).toBeVisible();
      await expect.element(menu(firstPath)).toHaveFocus();
      await row(second).click({
        button: 'right',
        force: true,
        position: { x: 31, y: 12 },
      });
      await expect.element(menu(secondPath)).toBeVisible();
      await expect.element(menu(secondPath)).toHaveAttribute('data-open', '');
      await expect
        .element(row(second))
        .toHaveAttribute('aria-haspopup', 'menu');
      if (firstPath !== secondPath)
        await expect.element(menu(firstPath)).not.toBeInTheDocument();
      const command = secondPath.endsWith('/') ? 'New file' : 'Duplicate';
      await expect
        .element(page.getByRole('menuitem', { name: command, exact: true }))
        .toBeVisible();
      await userEvent.keyboard('{Escape}');
      await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    }

    await expectInputFocus(row('beta'));
    await userEvent.keyboard('{End}{ContextMenu}');
    await expect.element(menu(last)).toBeVisible();
    await expect.element(menu(last)).toHaveAttribute('data-open', '');
    await expect
      .element(row(last))
      .toHaveAttribute('data-context-menu-open', '');
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expectInputFocus(row(last));
    await userEvent.keyboard('{Home}');

    await row('alpha').click({ button: 'right' });
    await expect.element(menu('alpha/')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await row('beta').click({
      button: 'right',
      force: true,
      position: { x: 31, y: 12 },
    });
    await expect.element(menu('beta/')).toHaveAttribute('data-open', '');
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();

    await row('alpha').click({ button: 'right' });
    await expect.element(menu('alpha/')).toBeVisible();
    await row('beta').click({
      button: 'right',
      force: true,
      position: { x: 31, y: 12 },
    });
    await expect.element(menu('beta/')).toBeVisible();
    await expect.element(menu('beta/')).toHaveAttribute('data-open', '');
    await page
      .getByRole('menuitem', { name: 'New folder', exact: true })
      .click();
    const name = page.getByRole('textbox', { name: /^Rename / });
    await expectInputFocus(name);
    await name.fill('second-target');
    await expect.element(name).toHaveValue('second-target');
    await userEvent.keyboard('{Enter}');
    await expect
      .poll(async () =>
        (await server.directory('beta')).entries.map((entry) => entry.name),
      )
      .toContain('second-target');
    await expect
      .poll(async () =>
        (await server.directory('alpha')).entries.map((entry) => entry.name),
      )
      .not.toContain('second-target');
  },
);

test('an agent inserting a preceding file dismisses the menu before its row can acquire another path', async ({
  render,
  repo,
}) => {
  await repo.write('guide.md', 'Guide\n');
  const page = await render.workspace();
  await page.viewport(1280, 800);
  await page
    .getByRole('navigation', { name: 'Side panel', exact: true })
    .getByRole('button', { name: 'Files', exact: true })
    .click();
  await page
    .getByRole('treeitem', { name: 'guide.md', exact: true })
    .click({ button: 'right' });
  await expect
    .element(page.getByRole('menu', { name: 'guide.md actions', exact: true }))
    .toBeVisible();
  await repo.write('a-before.md', 'An agent added this file\n');
  const inserted = page.getByRole('treeitem', {
    name: 'a-before.md',
    exact: true,
    includeHidden: true,
  });
  await expect.element(inserted).toBeVisible();
  await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
  await expect.element(inserted).not.toHaveAttribute('data-context-menu-open');
  await expect.element(inserted).not.toHaveAttribute('aria-haspopup');
});

test.for(
  [1280, 414].flatMap((width) =>
    (
      [
        ['New file', 'named', 'typed.md', ['second.md', 'typed.md']],
        ['New folder', 'named', 'typed-folder', ['second.md', 'typed-folder']],
        ['New file', 'blur', 'blurred.md', ['blurred.md', 'second.md']],
        [
          'New folder',
          'blur',
          'blurred-folder',
          ['blurred-folder', 'second.md'],
        ],
        ['New file', 'caret', 'typed.md', ['second.md', 'xtyped.md']],
        ['New folder', 'caret', 'typed-folder', ['second.md', 'xtyped-folder']],
        ['New file', 'default', '', ['second.md', 'untitled']],
        ['New folder', 'default', '', ['new-folder', 'second.md']],
        ['New file', 'empty', '', ['second.md']],
        ['New folder', 'empty', '', ['second.md']],
        ['New file', 'cancel', '', ['second.md']],
        ['New folder', 'cancel', '', ['second.md']],
        ['New file', 'invalid', 'second.md', ['second.md']],
        ['New folder', 'invalid', 'second.md', ['second.md']],
      ] as const
    ).map(([command, outcome, name, entries]) => ({
      width,
      command,
      outcome,
      name,
      entries,
    })),
  ),
)(
  '$command retains editor focus through a lazy read: $outcome at $width px',
  async (
    { width, command, outcome, name: value, entries },
    { render, repo, agent, server, fetchGate },
  ) => {
    await agent.editFile({
      kind: 'create',
      path: 'beta',
      entryKind: 'directory',
    });
    await repo.write('beta/second.md', 'Second folder\n');
    const held = fetchGate.holdNextDirectoryRead('beta');
    const page = await render.workspace();
    await page.viewport(width, 896);
    if (width === 414) {
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('tab', { name: 'Files', exact: true }).click();
    } else
      await page
        .getByRole('navigation', { name: 'Side panel', exact: true })
        .getByRole('button', { name: 'Files', exact: true })
        .click();
    held.arm();
    try {
      await page
        .getByRole('treeitem', { name: 'beta', exact: true })
        .click({ button: 'right' });
      await page.getByRole('menuitem', { name: command, exact: true }).click();
      const name = page.getByRole('textbox', { name: /^Rename / });
      await expect.element(name).toBeVisible();
      await expect.poll(() => held.held()).toBe(true);
      if (outcome === 'named' || outcome === 'blur' || outcome === 'caret') {
        await expectInputFocus(name);
        await userEvent.keyboard(value);
        await expect.element(name).toHaveValue(value);
      }
      held.release();
      await expect.poll(() => held.responded()).toBe(true);
      await expectInputFocus(name);
      if (outcome === 'named') await expect.element(name).toHaveValue(value);
      if (outcome === 'invalid') {
        await userEvent.keyboard(value);
        await expect.element(name).toHaveValue(value);
      }
      if (outcome === 'empty') await name.fill('');
      if (outcome === 'caret') {
        await userEvent.keyboard('{Home}x');
        await expect.element(name).toHaveValue(`x${value}`);
      }
      if (outcome === 'blur')
        await page
          .getByRole('textbox', { name: 'Search files', exact: true })
          .click();
      else
        await userEvent.keyboard(outcome === 'cancel' ? '{Escape}' : '{Enter}');
      if (outcome === 'invalid')
        await expect
          .element(
            page.getByText('An entry already exists at that path', {
              exact: true,
            }),
          )
          .toBeVisible();
      await expect.element(name).not.toBeInTheDocument();
      if (outcome === 'cancel' || outcome === 'empty')
        await expect
          .element(
            page.getByRole('treeitem', { name: 'second.md', exact: true }),
          )
          .toBeVisible();
      await expect
        .poll(async () =>
          (await server.directory('beta')).entries.map((entry) => entry.name),
        )
        .toEqual(entries);
    } finally {
      held.release();
    }
  },
);
