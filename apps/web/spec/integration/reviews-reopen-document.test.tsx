import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

for (const entryPoint of ['Files tree', 'Quick Open', 'Pinned']) {
  test(`${entryPoint} focuses an already-open file in the other pane and adds no tab`, async ({
    repo,
    render,
  }) => {
    await repo.write(repo.readme.path, repo.readme.committed);
    await repo.write('guide.txt', 'Guide to the project\n');
    await repo.commit('Add guide');
    await repo.write(repo.readme.path, repo.readme.changed);
    const workspace = await render.workspace();
    const review = () => userEvent.keyboard('{Alt>}{Shift>}r{/Shift}{/Alt}');
    await review();
    await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
    const row = workspace.getByRole('treeitem', {
      name: 'guide.txt',
      exact: true,
    });
    await row.click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: 'Pin file', exact: true })
      .click();
    await row.click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: 'Open to the side', exact: true })
      .click();
    const left = workspace.getByRole('region', {
      name: 'Left pane',
      exact: true,
    });
    const right = workspace.getByRole('region', {
      name: 'Right pane',
      exact: true,
    });
    await left.getByRole('tab', { name: 'Changes', exact: true }).click();
    await review();
    await expect.element(row).toBeVisible();
    if (entryPoint === 'Files tree') await row.click();
    else if (entryPoint === 'Pinned')
      await workspace
        .getByRole('region', { name: 'Pinned files', exact: true })
        .getByRole('button', { name: 'guide.txt', exact: true })
        .click();
    else {
      await userEvent.keyboard('{ControlOrMeta>}p{/ControlOrMeta}');
      await workspace
        .getByRole('combobox', { name: 'Find a file by name', exact: true })
        .fill('guide.txt');
      await workspace
        .getByRole('option', { name: 'guide.txt', exact: true })
        .click();
    }
    const tab = workspace.getByRole('tab', {
      name: 'guide.txt',
      exact: true,
    });
    await expect.element(tab).toHaveAttribute('data-entry', 'file:guide.txt');
    await expect.element(tab).toHaveFocus();
    await expect
      .element(
        right.getByRole('tab', {
          name: 'guide.txt',
          exact: true,
        }),
      )
      .toHaveAttribute('aria-selected', 'true');
    await expect
      .element(
        left.getByRole('tab', {
          name: 'guide.txt',
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
    await expect
      .element(left.getByRole('tab', { name: 'Changes', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await review();
    await row.click();
    await expect.element(tab).toHaveFocus();
    await expect
      .element(
        workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
      )
      .not.toBeInTheDocument();
  });
}

test('Show timeline is a distinct document and reopening it focuses its existing tab', async ({
  workspace,
  repo,
}) => {
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  const row = workspace.getByRole('treeitem', {
    name: repo.readme.path,
    exact: true,
  });
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace
    .getByRole('button', { name: 'Timeline', exact: true })
    .click();
  const timeline = workspace.getByRole('tab', {
    name: 'Timeline of README.md',
    exact: true,
  });
  await expect
    .element(timeline)
    .toHaveAttribute('data-entry', 'timeline:README.md');
  const file = workspace.getByRole('tab', {
    name: 'README.md',
    exact: true,
  });
  await expect.element(file).toHaveAttribute('data-entry', 'file:README.md');
  await file.click();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Show timeline', exact: true })
    .click();
  await expect.element(timeline).toHaveFocus();
  await expect.element(timeline).toHaveAttribute('aria-selected', 'true');
  await expect.element(file).toHaveAttribute('aria-selected', 'false');
});

test('the persistent Files tree reopens its selected file after focus moves to the other pane', async ({
  repo,
  render,
}) => {
  await repo.write('guide.txt', 'Guide to the project\n');
  const workspace = await render.workspace();
  await page.viewport(1440, 1000);
  try {
    const row = workspace.getByRole('treeitem', {
      name: 'guide.txt',
      exact: true,
    });
    await row.click();
    const readme = workspace.getByRole('treeitem', {
      name: 'README.md',
      exact: true,
    });
    await readme.click();
    await expect.element(row).toHaveAttribute('aria-selected', 'false');
    await expect.element(readme).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Control>}');
    await row.click();
    await userEvent.keyboard('{/Control}');
    await expect.element(row).toHaveAttribute('aria-selected', 'true');
    await expect.element(readme).toHaveAttribute('aria-selected', 'true');
    await row.click();
    await expect.element(readme).toHaveAttribute('aria-selected', 'false');
    const file = workspace.getByRole('tab', {
      name: 'guide.txt',
      exact: true,
    });
    await file.click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: /^Open to the side/ })
      .click();
    const left = workspace.getByRole('region', {
      name: 'Left pane',
      exact: true,
    });
    const right = workspace.getByRole('region', {
      name: 'Right pane',
      exact: true,
    });
    await left
      .getByRole('tab', { name: 'guide.txt', exact: true })
      .getByRole('button', { name: 'Close guide.txt', exact: true })
      .click();
    await left.getByRole('tab', { name: 'Changes', exact: true }).click();
    await row.click();
    await expect.element(file).toHaveFocus();
    await expect
      .element(
        right.getByRole('tab', {
          name: 'guide.txt',
          exact: true,
        }),
      )
      .toHaveAttribute('aria-selected', 'true');
    await expect
      .element(
        left.getByRole('tab', {
          name: 'guide.txt',
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
    await row.click();
    await expect.element(file).toHaveFocus();
  } finally {
    await page.viewport(414, 896);
  }
});

test('Changes and comment links focus an already-open diff in the other pane and reveal the comment there', async ({
  workspace,
  repo,
  agent,
}) => {
  await agent.comment(repo.readme.path, 'Please explain this change');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open to the side', exact: true })
    .click();
  const left = workspace.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  const original = left.getByRole('tab', {
    name: 'Changes',
    exact: true,
  });
  const tab = workspace.getByRole('tab', {
    name: 'README.md',
    exact: true,
  });
  await original.click();
  await userEvent.keyboard('{Alt>}{Shift>}r{/Shift}{/Alt}');
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'README.md · unstaged', exact: true })
    .click();
  await expect.element(tab).toHaveFocus();
  await expect.element(tab).toHaveAttribute('data-entry', 'change:README.md');
  await original.click();
  await userEvent.keyboard('{Alt>}{Shift>}r{/Shift}{/Alt}');
  await workspace.getByRole('tab', { name: /^Comments/ }).click();
  await workspace
    .getByRole('button', { name: /^README\.md Whole file/ })
    .click();
  await expect.element(tab).toHaveFocus();
  await expect
    .element(right.getByRole('button', { name: 'Reply', exact: true }))
    .toBeVisible();
  await expect
    .element(left.getByRole('tab', { name: 'README.md', exact: true }))
    .not.toBeInTheDocument();
  await expect.element(original).toHaveAttribute('aria-selected', 'true');
});
