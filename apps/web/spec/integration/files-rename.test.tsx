import { page as browserPage, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

const before = 'draft-notes.md';
const after = 'final-notes.md';

test('renaming a file in the tree moves it on disk and shows the new name', async ({
  render,
  repo,
  server,
}) => {
  await repo.write(before, 'Notes to rename\n');
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await opened
    .getByRole('treeitem', { name: before, exact: true })
    .click({ button: 'right' });
  await opened.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const name = opened.getByRole('textbox', { name: /rename/i });
  await expect.element(name).toBeVisible();
  await name.fill(after);
  await userEvent.keyboard('{Enter}');
  await expect
    .element(opened.getByRole('treeitem', { name: after, exact: true }))
    .toBeVisible();
  await expect
    .element(opened.getByRole('treeitem', { name: before, exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(
      opened.getByText('This change is no longer present.', { exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .toContain(after);
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .not.toContain(before);
});

test('renaming a file onto an existing name is refused and keeps both files', async ({
  render,
  repo,
  server,
}) => {
  await repo.write(after, 'Notes to rename\n');
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: after, exact: true })
    .click({ button: 'right' });
  const renameAction = page.getByRole('menuitem', {
    name: 'Rename',
    exact: true,
  });
  await expect.element(page.getByRole('menu')).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(renameAction).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  const name = page.getByRole('textbox', { name: /rename/i });
  await expect.element(name).toBeVisible();
  await name.fill(repo.readme.path);
  await userEvent.keyboard('{Enter}');
  await expect
    .element(page.getByText('Invalid name', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole('treeitem', { name: after, exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole('button', {
        name: `Close ${after}`,
        exact: true,
        includeHidden: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe(repo.readme.changed);
  await expect
    .poll(async () => (await server.text(after)).text)
    .toBe('Notes to rename\n');
});

for (const activation of ['pointer', 'keyboard'] as const) {
  test(`renaming a filtered result via ${activation} clears the actual search`, async ({
    render,
    repo,
    server,
  }) => {
    await repo.write(before, 'Notes to rename\n');
    const page = await render.workspace();
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('tab', { name: 'Files', exact: true }).click();
    const search = page.getByRole('textbox', {
      name: 'Search files',
      exact: true,
    });
    await search.fill('draft-notes');
    await expect
      .element(
        page.getByRole('treeitem', { name: repo.readme.path, exact: true }),
      )
      .not.toBeInTheDocument();
    await page
      .getByRole('treeitem', { name: before, exact: true })
      .click({ button: 'right' });
    const rename = page.getByRole('menuitem', { name: 'Rename', exact: true });
    if (activation === 'keyboard') {
      await expect.element(page.getByRole('menu')).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      await expect.element(rename).toHaveFocus();
      await userEvent.keyboard('{Enter}');
    } else {
      await rename.click();
    }
    const name = page.getByRole('textbox', { name: /^Rename / });
    await expect.element(name).toBeVisible();
    await expect.element(search).toHaveValue('');
    await expect
      .element(
        page.getByRole('treeitem', { name: repo.readme.path, exact: true }),
      )
      .toBeVisible();
    await name.fill(after);
    if (activation === 'keyboard') {
      await userEvent.keyboard('{Escape}');
      await expect
        .element(page.getByRole('treeitem', { name: before, exact: true }))
        .toBeVisible();
      await expect.element(search).toHaveValue('');
      await expect
        .poll(async () => (await server.text(before)).text)
        .toBe('Notes to rename\n');
      await expect
        .poll(async () =>
          (await server.directory('')).entries.map((entry) => entry.name),
        )
        .not.toContain(after);
    } else {
      await userEvent.keyboard('{Enter}');
      await expect
        .element(page.getByRole('treeitem', { name: after, exact: true }))
        .toBeVisible();
      await expect
        .poll(async () => (await server.text(after)).text)
        .toBe('Notes to rename\n');
      await expect
        .poll(async () =>
          (await server.directory('')).entries.map((entry) => entry.name),
        )
        .not.toContain(before);
    }
  });
}

test('renaming a pinned file clears the tree search before showing the inline name', async ({
  render,
  repo,
  server,
}) => {
  await repo.write(before, 'Pinned notes\n');
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: before, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Pin file', exact: true }).click();
  const pinned = page.getByRole('region', {
    name: 'Pinned files',
    exact: true,
  });
  const entry = pinned.getByRole('button', { name: before, exact: true });
  await expect.element(entry).toBeVisible();
  const search = page.getByRole('textbox', {
    name: 'Search files',
    exact: true,
  });
  await search.fill('draft-notes');
  await expect
    .element(
      page.getByRole('treeitem', { name: repo.readme.path, exact: true }),
    )
    .not.toBeInTheDocument();
  await entry.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const name = page.getByRole('textbox', { name: /^Rename / });
  await expect.element(name).toBeVisible();
  await expect.element(search).toHaveValue('');
  await expect
    .element(
      page.getByRole('treeitem', { name: repo.readme.path, exact: true }),
    )
    .toBeVisible();
  await name.fill(after);
  await userEvent.keyboard('{Enter}');
  await expect
    .element(page.getByRole('treeitem', { name: after, exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.text(after)).text)
    .toBe('Pinned notes\n');
});

test('renaming an open file moves its tab to the new name', async ({
  render,
  repo,
}) => {
  await repo.write(before, 'Notes to rename\n');
  const app = await render.route('/');
  const page = app.page;
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page.getByRole('treeitem', { name: before, exact: true }).click();
  await expect
    .element(page.getByRole('tab', { name: before, exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: before, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const name = page.getByRole('textbox', { name: /rename/i });
  await expect.element(name).toBeVisible();
  await name.fill(after);
  await userEvent.keyboard('{Enter}');
  await expect
    .element(page.getByRole('treeitem', { name: after, exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  const renamed = page.getByRole('tab', { name: after, exact: true });
  await expect.element(renamed).toHaveAttribute('data-entry', `file:${after}`);
  await expect.element(renamed).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      page.getByRole('tab', { name: before, exact: true, includeHidden: true }),
    )
    .not.toBeInTheDocument();
  await expect.poll(() => app.title()).toMatch(new RegExp(`^${after} — `));
  await expect
    .element(page.getByText(/could not be loaded/))
    .not.toBeInTheDocument();
});

test('renaming a file also moves a tab opened to the side during the request', async ({
  fetchGate,
  render,
  repo,
}) => {
  await browserPage.viewport(1280, 896);
  try {
    await repo.write(before, 'Notes to rename\n');
    const gate = fetchGate.holdNextPost('/files');
    const page = await render.workspace();
    await userEvent.keyboard('{Alt>}1{/Alt}');
    const file = page.getByRole('treeitem', { name: before, exact: true });
    await file.click();
    const tab = page.getByRole('tab', { name: before, exact: true });
    await expect.element(tab).toHaveAttribute('aria-selected', 'true');
    await file.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
    await page.getByRole('textbox', { name: /rename/i }).fill(after);
    gate.arm();
    await userEvent.keyboard('{Enter}');
    await gate.requested;
    await tab.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Open to the side/ }).click();
    const right = page.getByRole('region', { name: 'Right pane', exact: true });
    await expect
      .element(right.getByRole('tab', { name: before, exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    gate.release();
    for (const name of ['Left pane', 'Right pane']) {
      const pane = page.getByRole('region', { name, exact: true });
      await expect
        .element(pane.getByRole('tab', { name: after, exact: true }))
        .toHaveAttribute('aria-selected', 'true');
    }
    await expect.element(tab).not.toBeInTheDocument();
  } finally {
    fetchGate.restore();
    await browserPage.viewport(414, 896);
  }
});
