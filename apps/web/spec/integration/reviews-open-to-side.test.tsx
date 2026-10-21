import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('invoking the right Review control chooses the source pane before opening a file to the left', async ({
  workspace,
  repo,
}) => {
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace
    .getByRole('tab', {
      name: `${repo.readme.path} Close ${repo.readme.path}`,
      exact: true,
    })
    .click({ button: 'right' });
  await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
  const left = workspace.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  await left.getByRole('button', { name: 'Edit', exact: true }).click();
  await right.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open in the left pane', exact: true })
    .click();
  const destination = left.getByRole('tab', {
    name: `${repo.readme.path} Close ${repo.readme.path}`,
    exact: true,
    selected: true,
  });
  await expect
    .element(destination)
    .toHaveAttribute('data-entry', `change:${repo.readme.path}`);
  await expect.element(destination).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      right.getByRole('tab', {
        name: `${repo.readme.path} Close ${repo.readme.path}`,
        exact: true,
      }),
    )
    .toHaveAttribute('data-entry', `file:${repo.readme.path}`);
  await expect
    .element(
      right.getByRole('tab', {
        name: `${repo.readme.path} Close ${repo.readme.path}`,
        exact: true,
      }),
    )
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      workspace.getByRole('dialog', {
        name: 'Worktree review',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect.element(destination).toHaveFocus();
});

test('tree side menu preserves the source document and focuses the destination after the sheet closes', async ({
  workspace,
  repo,
}) => {
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
  const destination = right.getByRole('tab', {
    name: `${repo.readme.path} Close ${repo.readme.path}`,
    exact: true,
  });
  await expect
    .element(
      left.getByRole('tab', { name: 'Changes Close Changes', exact: true }),
    )
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(destination)
    .toHaveAttribute('data-entry', `change:${repo.readme.path}`);
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(destination).toHaveFocus();
  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect.element(right).not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('tab', {
        name: 'Changes Close Changes',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-selected', 'true');
});

test('Alt-click on the already-selected unchanged tree file opens it once in the other pane', async ({
  repo,
  render,
}) => {
  await repo.write('guide.txt', 'Guide to the project\n');
  await repo.commit('Add guide');
  await repo.write(repo.readme.path, repo.readme.changed);
  const workspace = await render.workspace();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: 'guide.txt', exact: true })
    .click();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const row = workspace.getByRole('treeitem', {
    name: 'guide.txt',
    exact: true,
  });
  await expect.element(row).toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Alt>}');
  await row.click();
  await userEvent.keyboard('{/Alt}');
  const left = workspace.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  const destination = right.getByRole('tab', {
    name: 'guide.txt Close guide.txt',
    exact: true,
  });
  await expect
    .element(
      left.getByRole('tab', { name: 'guide.txt Close guide.txt', exact: true }),
    )
    .toHaveAttribute('data-entry', 'file:guide.txt');
  await expect
    .element(destination)
    .toHaveAttribute('data-entry', 'file:guide.txt');
  await expect
    .element(
      right
        .getByRole('tablist', {
          name: 'Open documents, right pane',
          exact: true,
        })
        .getByRole('tab'),
    )
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(destination).toHaveFocus();
});

test('pinned side menu and Alt-click follow the focused pane and keep the existing tab', async ({
  workspace,
  repo,
}) => {
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Pin file', exact: true })
    .click();
  const pinned = workspace
    .getByRole('region', { name: 'Pinned files', exact: true })
    .getByRole('button', { name: repo.readme.path, exact: true });
  await pinned.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open to the side', exact: true })
    .click();
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  const rightTab = right.getByRole('tab', {
    name: `${repo.readme.path} Close ${repo.readme.path}`,
    exact: true,
  });
  await expect
    .element(rightTab)
    .toHaveAttribute('data-entry', `change:${repo.readme.path}`);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await pinned.click({ button: 'right' });
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Open in the left pane',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('{Alt>}');
  await pinned.click();
  await userEvent.keyboard('{/Alt}');
  const leftTab = workspace
    .getByRole('region', { name: 'Left pane', exact: true })
    .getByRole('tab', {
      name: `${repo.readme.path} Close ${repo.readme.path}`,
      exact: true,
    });
  await expect
    .element(leftTab)
    .toHaveAttribute('data-entry', `change:${repo.readme.path}`);
  await expect.element(rightTab).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(leftTab).toHaveFocus();
  await userEvent.keyboard('{Alt>}{Shift>}r{/Shift}{/Alt}');
  await pinned.click({ button: 'right' });
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Open in the right pane',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
});

test('changed-file context action and Alt-click preserve the diff identity in both panes', async ({
  workspace,
  repo,
}) => {
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  const row = workspace.getByRole('button', {
    name: new RegExp(`^${repo.readme.path.replace('.', '\\.')}( · .+)?$`),
  });
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open to the side', exact: true })
    .click();
  const rightTab = workspace
    .getByRole('region', { name: 'Right pane', exact: true })
    .getByRole('tab', {
      name: `${repo.readme.path} Close ${repo.readme.path}`,
      exact: true,
    });
  await expect
    .element(rightTab)
    .toHaveAttribute('data-entry', `change:${repo.readme.path}`);
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(rightTab).toHaveFocus();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await row.click({ button: 'right' });
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Open in the left pane',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('{Alt>}');
  await row.click();
  await userEvent.keyboard('{/Alt}');
  const leftTab = workspace
    .getByRole('region', { name: 'Left pane', exact: true })
    .getByRole('tab', {
      name: `${repo.readme.path} Close ${repo.readme.path}`,
      exact: true,
    });
  await expect
    .element(leftTab)
    .toHaveAttribute('data-entry', `change:${repo.readme.path}`);
  await expect.element(rightTab).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(leftTab).toHaveFocus();
});

test('history side menu and Alt-click open the real commit identity', async ({
  workspace,
  repo,
  server,
}) => {
  const initial = (await server.commits()).commits[0];
  if (initial === undefined)
    throw new Error('The sample repository has no initial commit.');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  const row = workspace.getByRole('button', {
    name: new RegExp(`^${repo.initialCommit}`),
  });
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open to the side', exact: true })
    .click();
  const name = `${initial.oid.slice(0, 7)} Close ${initial.oid.slice(0, 7)}`;
  const rightTab = workspace
    .getByRole('region', { name: 'Right pane', exact: true })
    .getByRole('tab', { name, exact: true });
  await expect
    .element(rightTab)
    .toHaveAttribute('data-entry', `commit:${initial.oid}`);
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(rightTab).toHaveFocus();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await row.click({ button: 'right' });
  await expect
    .element(
      workspace.getByRole('menuitem', {
        name: 'Open in the left pane',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('{Alt>}');
  await row.click();
  await userEvent.keyboard('{/Alt}');
  const leftTab = workspace
    .getByRole('region', { name: 'Left pane', exact: true })
    .getByRole('tab', { name, exact: true });
  await expect
    .element(leftTab)
    .toHaveAttribute('data-entry', `commit:${initial.oid}`);
  await expect.element(rightTab).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(leftTab).toHaveFocus();
});

test('branch file side actions keep the branch document kind', async ({
  workspace,
  repo,
}) => {
  await repo.branch('feature');
  await repo.switch('feature');
  await repo.write('notes.md', 'Branch notes\n');
  await repo.commit('Add notes');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Branch', exact: true }).click();
  const row = workspace.getByRole('button', {
    name: 'notes.md · added',
    exact: true,
  });
  await row.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open to the side', exact: true })
    .click();
  const destination = workspace
    .getByRole('region', { name: 'Right pane', exact: true })
    .getByRole('tab', { name: 'notes.md Close notes.md', exact: true });
  await expect
    .element(destination)
    .toHaveAttribute('data-entry', 'branch:notes.md');
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(destination).toHaveFocus();
});

test('graph commit rows offer a side menu and Alt-click without replacing the graph', async ({
  workspace,
  repo,
  server,
}) => {
  const initial = (await server.commits()).commits[0];
  if (initial === undefined)
    throw new Error('The sample repository has no initial commit.');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'History', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Open graph', exact: true })
    .click();
  const row = workspace
    .getByRole('region', { name: 'Review content', exact: true })
    .getByRole('button', {
      name: new RegExp(`^${repo.initialCommit}`),
    });
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
  await expect
    .element(left.getByRole('tab', { name: 'Graph Close Graph', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  const destination = right.getByRole('tab', {
    name: `${initial.oid.slice(0, 7)} Close ${initial.oid.slice(0, 7)}`,
    exact: true,
  });
  await expect
    .element(destination)
    .toHaveAttribute('data-entry', `commit:${initial.oid}`);
  await expect.element(destination).toHaveFocus();
  await userEvent.keyboard('{Alt>}');
  await left
    .getByRole('button', { name: new RegExp(`^${repo.initialCommit}`) })
    .click();
  await userEvent.keyboard('{/Alt}');
  await expect
    .element(left.getByRole('tab', { name: 'Graph Close Graph', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(destination)
    .toHaveAttribute('data-entry', `commit:${initial.oid}`);
  await expect.element(destination).toHaveFocus();
});

test('timeline commit side actions preserve the file comparison and leave the timeline open', async ({
  workspace,
  repo,
  server,
}) => {
  const initial = (await server.commits()).commits[0];
  if (initial === undefined)
    throw new Error('The sample repository has no initial commit.');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Show timeline', exact: true })
    .click();
  await workspace
    .getByRole('button', { name: new RegExp(`^${repo.initialCommit}`) })
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
  await expect
    .element(
      left.getByRole('list', {
        name: `Timeline of ${repo.readme.path}`,
        exact: true,
      }),
    )
    .toBeVisible();
  const destination = right.getByRole('tab', {
    name: `${initial.oid.slice(0, 7)} Close ${initial.oid.slice(0, 7)}`,
    exact: true,
  });
  await expect
    .element(destination)
    .toHaveAttribute('data-entry', `commit:${initial.oid}`);
  await expect
    .element(right.getByText(repo.readme.committed.trim(), { exact: true }))
    .toBeVisible();
  await expect.element(destination).toHaveFocus();
  await userEvent.keyboard('{Alt>}');
  await left
    .getByRole('button', { name: new RegExp(`^${repo.initialCommit}`) })
    .click();
  await userEvent.keyboard('{/Alt}');
  await expect
    .element(
      left.getByRole('list', {
        name: `Timeline of ${repo.readme.path}`,
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.element(destination).toHaveFocus();
});

test('closing the destination during sheet exit cancels its focus transfer and restores ordinary dismissal', async ({
  workspace,
  repo,
}) => {
  const trigger = workspace.getByRole('button', {
    name: 'Review',
    exact: true,
  });
  const sheet = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await trigger.click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open to the side', exact: true })
    .click();
  await expect.element(sheet).toHaveAttribute('data-ending-style', '');
  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect
    .element(workspace.getByRole('region', { name: 'Right pane', exact: true }))
    .not.toBeInTheDocument();
  await expect.element(sheet).not.toBeInTheDocument();
  await expect
    .element(
      workspace.getByRole('tab', {
        name: 'Changes Close Changes',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-selected', 'true');
  await expect.element(trigger).toHaveFocus();
  await trigger.click();
  await expect.element(sheet).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(sheet).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();
});

test('switching to another tab during sheet exit cancels the older destination focus', async ({
  workspace,
  repo,
}) => {
  await repo.write('guide.txt', 'Guide to the project\n');
  const trigger = workspace.getByRole('button', {
    name: 'Review',
    exact: true,
  });
  const sheet = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await trigger.click();
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
  const existing = right.getByRole('tab', {
    name: `${repo.readme.path} Close ${repo.readme.path}`,
    exact: true,
  });
  await expect.element(sheet).not.toBeInTheDocument();
  await expect.element(existing).toHaveFocus();
  await left
    .getByRole('tab', { name: 'Changes Close Changes', exact: true })
    .click();
  await userEvent.keyboard('{Alt>}{Shift>}r{/Shift}{/Alt}');
  await workspace
    .getByRole('treeitem', { name: 'guide.txt', exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open in the right pane', exact: true })
    .click();
  await expect.element(sheet).toHaveAttribute('data-ending-style', '');
  await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
  await expect.element(sheet).not.toBeInTheDocument();
  await expect.element(existing).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      right.getByRole('tab', {
        name: 'guide.txt Close guide.txt',
        exact: true,
      }),
    )
    .toHaveAttribute('aria-selected', 'false');
  await expect.element(trigger).toHaveFocus();
});

test('newer find-input focus during sheet exit supersedes the side-open tab focus', async ({
  repo,
  render,
}) => {
  await repo.write('guide.txt', 'needle one\nneedle two\n');
  await repo.commit('Add guide');
  await repo.write(repo.readme.path, repo.readme.changed);
  const workspace = await render.workspace();
  const trigger = workspace.getByRole('button', {
    name: 'Review',
    exact: true,
  });
  const sheet = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await trigger.click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: 'guide.txt', exact: true })
    .click({ button: 'right' });
  await workspace.getByRole('menuitem', { name: 'Open', exact: true }).click();
  await expect
    .element(workspace.getByText('needle one', { exact: true }))
    .toBeVisible();
  await expect.element(sheet).not.toBeInTheDocument();
  await trigger.click();
  await workspace
    .getByRole('treeitem', { name: 'guide.txt', exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open to the side', exact: true })
    .click();
  await expect.element(sheet).toHaveAttribute('data-ending-style', '');
  await userEvent.keyboard('{ControlOrMeta>}f{/ControlOrMeta}');
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  const find = right.getByRole('textbox', {
    name: 'Find in file',
    exact: true,
  });
  await expect.element(find).toHaveFocus();
  await expect.element(sheet).not.toBeInTheDocument();
  await expect.element(find).toHaveFocus();
  await userEvent.keyboard('needle');
  await expect.element(find).toHaveValue('needle');
});
