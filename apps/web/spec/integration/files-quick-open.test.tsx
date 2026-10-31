import { userEvent } from 'vitest/browser';
import { expect, test, type Render, type Repo } from './fixtures.tsx';

const target = 'quick-target.md';

async function openFiles(render: Render, repo: Repo) {
  await repo.write(target, '# Quick target\n');
  await repo.write('.gitignore', 'build.log\n');
  await repo.write('build.log', 'ignored output\n');
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect
    .element(
      opened.getByRole('treeitem', { name: repo.readme.path, exact: true }),
    )
    .toBeVisible();
  return opened;
}

test('quick open finds a worktree file by name and opens it', async ({
  render,
  repo,
  server,
}) => {
  const opened = await openFiles(render, repo);
  await expect
    .element(
      opened.getByRole('treeitem', { name: repo.readme.path, exact: true }),
    )
    .toBeVisible();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const search = opened.getByRole('combobox', {
    name: 'Find a file by name',
    exact: true,
  });
  await expect.element(search).toBeVisible();
  await search.fill('quick');
  await opened.getByRole('option', { name: target, exact: true }).click();
  await expect
    .element(opened.getByRole('heading', { name: 'Quick target', exact: true }))
    .toBeVisible();
  await expect.poll(async () => (await server.paths()).paths).toContain(target);
});

test('quick open finds no file an ignore rule hides', async ({
  render,
  repo,
  server,
}) => {
  const page = await openFiles(render, repo);
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const search = page.getByRole('combobox', {
    name: 'Find a file by name',
    exact: true,
  });
  await expect.element(search).toBeVisible();
  await search.fill('build.log');
  await expect
    .element(page.getByText('No file matches that name.', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.paths()).paths)
    .not.toContain('build.log');
});

test('an explicit ignored file path opens without adding ignored paths to name search', async ({
  render,
  repo,
  server,
  agent,
}) => {
  await repo.write('.gitignore', 'config/\n');
  await agent.editFile({
    kind: 'create',
    path: 'config',
    entryKind: 'directory',
  });
  await repo.write('config/.env', 'KNOWN_PATH_VALUE=visible\n');
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const search = page.getByRole('combobox', {
    name: 'Find a file by name',
    exact: true,
  });
  await search.fill('config/.env');
  await page
    .getByRole('option', { name: 'Open path config/.env', exact: true })
    .click();
  await expect
    .element(page.getByText('KNOWN_PATH_VALUE=visible', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.paths()).paths)
    .not.toContain('config/.env');
});

test('hidden files stay out of quick open until the Files hidden toggle is enabled', async ({
  render,
  repo,
}) => {
  const page = await openFiles(render, repo);
  await page
    .getByRole('treeitem', { name: target, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Hide file', exact: true }).click();
  await expect
    .element(page.getByRole('treeitem', { name: target, exact: true }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const search = page.getByRole('combobox', {
    name: 'Find a file by name',
    exact: true,
  });
  await search.fill(target);
  await expect
    .element(page.getByText('No file matches that name.', { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await page
    .getByRole('region', { name: 'All files', exact: true })
    .getByRole('button', { name: 'Show', exact: true })
    .click();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  await search.fill(target);
  await expect
    .element(page.getByRole('option', { name: target, exact: true }))
    .toBeVisible();
});

test('quick open reads names only when opened, waits for visibility and reuses its tab', async ({
  render,
  repo,
  fetchGate,
}) => {
  await repo.write(target, '# Quick target\n');
  const reads = fetchGate.recordFileLookupReads();
  const held = fetchGate.holdNextFilePreferences();
  held.arm();
  const page = await render.workspace();
  await expect
    .element(page.getByRole('dialog', { name: 'Worktree review', exact: true }))
    .not.toBeInTheDocument();
  await expect.poll(() => reads.paths).toEqual([]);
  await expect.poll(() => reads.preferences).toEqual([]);
  try {
    await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
    await held.requested;
    const search = page.getByRole('combobox', {
      name: 'Find a file by name',
      exact: true,
    });
    await search.fill('quick');
    await expect
      .element(page.getByText('Reading file visibility…', { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText('Reading file names…', { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole('option', { name: target, exact: true }))
      .not.toBeInTheDocument();
    held.release();
    await page.getByRole('option', { name: target, exact: true }).click();
    await expect
      .element(page.getByRole('heading', { name: 'Quick target', exact: true }))
      .toBeVisible();
    await expect.poll(() => reads.paths).toHaveLength(1);
    await expect.poll(() => reads.preferences).toHaveLength(1);
    await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
    await search.fill('quick');
    await page.getByRole('option', { name: target, exact: true }).click();
    await expect
      .element(page.getByRole('tab', { name: target, exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole('tab', { name: target, exact: true }))
      .toHaveAttribute('aria-selected', 'true');
  } finally {
    held.release();
  }
});

test('quick open ranks names and shows basename before the dimmed parent', async ({
  render,
  repo,
  agent,
}) => {
  await agent.editFile({
    kind: 'create',
    path: 'needle.txt',
    entryKind: 'directory',
  });
  await agent.editFile({
    kind: 'create',
    path: 'deep',
    entryKind: 'directory',
  });
  await repo.write('needle.txt/x.txt', 'Path match\n');
  await repo.write('xneedle.txt', 'Contained basename\n');
  await repo.write('needle.txt-more', 'Prefix basename\n');
  await repo.write('deep/needle.txt', 'Exact basename\n');
  const page = await render.workspace();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const search = page.getByRole('combobox', {
    name: 'Find a file by name',
    exact: true,
  });
  await search.fill('needle.txt');
  const options = page.getByRole('option');
  await expect.element(options.nth(0)).toHaveAccessibleName('deep/needle.txt');
  await expect.element(options.nth(1)).toHaveAccessibleName('needle.txt-more');
  await expect.element(options.nth(2)).toHaveAccessibleName('xneedle.txt');
  await expect.element(options.nth(3)).toHaveAccessibleName('needle.txt/x.txt');
  await expect.element(options.nth(0)).toHaveTextContent('needle.txtdeep');
  await options.nth(0).click();
  await expect
    .element(page.getByRole('tab', { name: 'deep/needle.txt', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
});

test('empty quick open lists open file tabs by activation then deduplicated pinned files without scanning paths', async ({
  render,
  repo,
  agent,
  fetchGate,
}) => {
  for (const name of [
    'first.txt',
    'second.txt',
    'third.txt',
    'pin.txt',
    'hidden.txt',
  ])
    await repo.write(name, name + '\n');
  await agent.editFile({
    kind: 'create',
    path: 'folder',
    entryKind: 'directory',
  });
  const reads = fetchGate.recordFileLookupReads();
  const page = await render.workspace();
  const review = async () => {
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('tab', { name: 'Files', exact: true }).click();
  };
  await review();
  for (const name of ['first.txt', 'pin.txt', 'hidden.txt', 'folder']) {
    await page
      .getByRole('treeitem', { name, exact: true })
      .click({ button: 'right' });
    await page
      .getByRole('menuitem', {
        name: name === 'folder' ? 'Pin folder' : 'Pin file',
        exact: true,
      })
      .click();
  }
  await page
    .getByRole('treeitem', { name: 'hidden.txt', exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Hide file', exact: true }).click();
  for (const name of ['first.txt', 'second.txt', 'third.txt']) {
    await page.getByRole('treeitem', { name, exact: true }).click();
    await expect
      .element(page.getByRole('tab', { name, exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    if (name !== 'third.txt') await review();
  }
  await page.getByRole('tab', { name: 'first.txt', exact: true }).click();
  await page.getByRole('tab', { name: 'third.txt', exact: true }).click();
  await page.getByRole('tab', { name: 'second.txt', exact: true }).click();
  const fileTabs = page.getByRole('tab', {
    name: /^(first|second|third)\.txt$/,
  });
  await expect.element(fileTabs.nth(0)).toHaveAccessibleName('first.txt');
  await expect.element(fileTabs.nth(1)).toHaveAccessibleName('second.txt');
  await expect.element(fileTabs.nth(2)).toHaveAccessibleName('third.txt');
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  const options = page.getByRole('option');
  await expect.element(options.nth(0)).toHaveAccessibleName('second.txt');
  await expect.element(options.nth(1)).toHaveAccessibleName('third.txt');
  await expect.element(options.nth(2)).toHaveAccessibleName('first.txt');
  await expect.element(options.nth(3)).toHaveAccessibleName('pin.txt');
  await expect.element(options.nth(4)).not.toBeInTheDocument();
  await expect.poll(() => reads.paths).toEqual([]);
  await page.getByRole('option', { name: 'third.txt', exact: true }).click();
  await expect
    .element(page.getByRole('tab', { name: 'third.txt', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(page.getByRole('tab', { name: 'third.txt', exact: true }))
    .toHaveAttribute('data-entry', 'file:third.txt');
  await page
    .getByRole('tab', { name: 'second.txt', exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^Close Alt/ }).click();
  await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
  await expect.element(options.nth(0)).toHaveAccessibleName('third.txt');
  await expect.element(options.nth(1)).toHaveAccessibleName('first.txt');
  await expect.element(options.nth(2)).toHaveAccessibleName('pin.txt');
  await expect.element(options.nth(3)).not.toBeInTheDocument();
  await expect.poll(() => reads.paths).toEqual([]);
  await userEvent.keyboard('{Escape}');
});
