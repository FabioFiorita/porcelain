import { userEvent } from 'vite-plus/test/browser';
import {
  expect,
  expectInputFocus,
  test,
  type Agent,
  type Render,
  type Repo,
} from './fixtures.tsx';

async function openFolderTree(
  width: number,
  { render, repo, agent }: { render: Render; repo: Repo; agent: Agent },
  rows: readonly string[],
) {
  for (const path of ['alpha', 'beta'])
    await agent.editFile({ kind: 'create', path, entryKind: 'directory' });
  await repo.write('alpha/first.md', 'First folder\n');
  await repo.write('beta/second.md', 'Second folder\n');
  for (const path of rows) await repo.write(path, 'Row\n');
  await repo.commit('Add the tree rows');
  const page = await render.workspace();
  await page.viewport(width, 896);
  if (width === 414) {
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('tab', { name: 'Files', exact: true }).click();
  } else await userEvent.keyboard('{Alt>}1{/Alt}');
  const row = (name: string) =>
    page.getByRole('treeitem', { name, exact: true, includeHidden: true });
  const menu = (path: string) =>
    page.getByRole('menu', { name: `${path} actions`, exact: true });
  return { page, row, menu };
}

test.for([1280, 414])(
  'closing a file-tree menu returns keyboard focus to its row, the last row included, at %ipx',
  async (width, { render, repo, agent }) => {
    const last = 'z-last-with-a-long-name-that-still-needs-the-correct-menu.md';
    const { page, row, menu } = await openFolderTree(
      width,
      { render, repo, agent },
      [
        'guide.md',
        ...Array.from(
          { length: 40 },
          (_, index) => `row-${String(index).padStart(2, '0')}.md`,
        ),
        last,
      ],
    );

    await row('beta').click({ button: 'right' });
    await expect.element(menu('beta/')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
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

    await userEvent.keyboard('{End}{Home}{ContextMenu}');
    await expect.element(menu('alpha/')).toHaveAttribute('data-open', '');
    await expect.element(menu(last)).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expectInputFocus(row('alpha'));
  },
);

test('Escape drops a file-tree menu the keyboard asked for while the tree was still scrolling', async ({
  render,
  repo,
  agent,
}) => {
  const last = 'z-last.md';
  const { page, row } = await openFolderTree(1280, { render, repo, agent }, [
    ...Array.from(
      { length: 40 },
      (_, index) => `row-${String(index).padStart(2, '0')}.md`,
    ),
    last,
  ]);
  await row('beta').click({ button: 'right' });
  await userEvent.keyboard('{Escape}');
  await expectInputFocus(row('beta'));
  await userEvent.keyboard('{End}{ContextMenu}{Escape}');
  await expectInputFocus(row(last));
  await userEvent.keyboard('{ArrowUp}');
  await expectInputFocus(row('row-39.md'));
  await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test.for([1280, 414])(
  'a file-tree menu opened right after another acts on its own folder at %ipx',
  async (width, { render, repo, agent, server }) => {
    const { page, row, menu } = await openFolderTree(
      width,
      { render, repo, agent },
      [],
    );

    await row('alpha').click({ button: 'right' });
    await expect.element(menu('alpha/')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await row('beta').click({
      button: 'right',
      force: true,
      position: { x: 31, y: 12 },
    });
    await expect.element(menu('beta/')).toHaveAttribute('data-open', '');
    await expect.element(menu('beta/')).toHaveFocus();
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
    await expect(
      server
        .directory('alpha')
        .then((directory) => directory.entries.map((entry) => entry.name)),
    ).resolves.not.toContain('second-target');
  },
);

test('an agent inserting a preceding file dismisses the menu before its row can acquire another path', async ({
  render,
  repo,
}) => {
  await repo.write('guide.md', 'Guide\n');
  const page = await render.workspace();
  await page.viewport(1280, 800);
  await userEvent.keyboard('{Alt>}1{/Alt}');
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
    } else await userEvent.keyboard('{Alt>}1{/Alt}');
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

test('a rejected create never opens the existing file while its response is pending', async ({
  render,
  repo,
  agent,
  server,
  fetchGate,
}) => {
  await agent.editFile({
    kind: 'create',
    path: 'beta',
    entryKind: 'directory',
  });
  await repo.write('beta/second.md', 'Second folder\n');
  const directory = fetchGate.holdNextDirectoryRead('beta');
  const create = fetchGate.holdNextPost('/files');
  const page = await render.workspace();
  await page.viewport(414, 896);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  directory.arm();
  try {
    await page
      .getByRole('treeitem', { name: 'beta', exact: true })
      .click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'New file', exact: true }).click();
    const name = page.getByRole('textbox', { name: /^Rename / });
    await expect.element(name).toBeVisible();
    await expect.poll(() => directory.held()).toBe(true);
    directory.release();
    await expect.poll(() => directory.responded()).toBe(true);
    await expectInputFocus(name);
    await userEvent.keyboard('second.md');
    create.arm();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => create.held()).toBe(true);
    await expect
      .element(
        page.getByRole('dialog', { name: 'Worktree review', exact: true }),
      )
      .toBeVisible();
    await expect
      .element(page.getByRole('tab', { name: 'beta/second.md', exact: true }))
      .not.toBeInTheDocument();
    create.release();
    await expect
      .element(
        page.getByText('An entry already exists at that path', { exact: true }),
      )
      .toBeVisible();
    await expect
      .poll(async () => (await server.text('beta/second.md')).text)
      .toBe('Second folder\n');
  } finally {
    directory.release();
    create.release();
  }
});
