import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('returning from Settings restores the focused side pane for tab shortcuts', async ({
  render,
  server,
  repo,
}) => {
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree');
  const route = await render.route(`/${project.id}/${worktree.id}`);
  const workspace = route.page;
  await userEvent.keyboard('{Alt>}1{/Alt}');
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  await expect.element(right).toHaveAttribute('data-focused', 'true');
  const destination = route.location();
  await route.navigate('/settings/general');
  await expect.element(right).not.toBeInTheDocument();
  await route.navigate(destination);
  await expect.element(right).toHaveAttribute('data-focused', 'true');
  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect.element(right).not.toBeInTheDocument();
  await expect
    .element(workspace.getByRole('tab', { name: 'Changes', exact: true }))
    .toBeVisible();
});

test('opening and closing a side file keeps the primary walkthrough mounted', async ({
  workspace,
  agent,
  repo,
  reviewLayout,
}) => {
  await agent.publishArchitecture();
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect.element(review).toBeVisible();
  const continuity = reviewLayout.continuity(review);
  try {
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
    await workspace
      .getByRole('treeitem', { name: repo.readme.path, exact: true })
      .click({ button: 'right' });
    await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
    const right = workspace.getByRole('region', {
      name: 'Right pane',
      exact: true,
    });
    await expect.element(right).toBeVisible();
    await expect
      .poll(() => continuity.read())
      .toEqual({ remounted: false, reloaded: false });
    await right
      .getByRole('tab', { name: repo.readme.path, exact: true })
      .click();
    await userEvent.keyboard('{Alt>}w{/Alt}');
    await expect.element(right).not.toBeInTheDocument();
    await expect
      .poll(() => continuity.read())
      .toEqual({ remounted: false, reloaded: false });
  } finally {
    continuity.stop();
  }
});

for (const [width, labelled] of [
  [1440, true],
  [1080, false],
  [414, false],
] as const) {
  const splitTest = test.extend('splitGitControls', async ({
    render,
    server,
    repo,
  }, { onCleanup }) => {
    onCleanup(() => page.viewport(414, 896));
    const project = await server.project();
    const worktree = project.worktrees.find((entry) => entry.main);
    if (!worktree) throw new Error('The fixture has no main worktree');
    const { page: workspace } = await render.route(
      `/${project.id}/${worktree.id}`,
    );
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
    await workspace
      .getByRole('treeitem', { name: repo.readme.path, exact: true })
      .click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: 'Open file', exact: true })
      .click();
    await workspace
      .getByRole('tab', { name: new RegExp(repo.readme.path), exact: true })
      .click({ button: 'right' });
    await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
    await page.viewport(width, 896);
    if (width === 1440) {
      await userEvent.keyboard('{Alt>}1{/Alt}');
      await workspace
        .getByRole('button', { name: 'Hide side panel', exact: true })
        .click();
    }
    const right = workspace.getByRole('region', {
      name: 'Right pane',
      exact: true,
    });
    await expect.element(right).toBeVisible();
    return { workspace, right };
  });

  splitTest(
    `split Git controls keep their label only when the pane has room at ${width} px`,
    async ({ splitGitControls: { workspace, right } }) => {
      const commit = right.getByRole('button', { name: 'Commit', exact: true });
      await expect.element(commit).toBeVisible();
      const label = commit.getByText('Commit', { exact: true });
      if (labelled) await expect.element(label).toBeVisible();
      else await expect.element(label).not.toBeVisible();
      await right
        .getByRole('button', { name: 'Git actions', exact: true })
        .click();
      await expect
        .element(workspace.getByRole('menuitem', { name: /^Commit…/ }))
        .toBeVisible();
      await userEvent.keyboard('{Escape}');
    },
  );
}

test('split tabs register their shortcuts once and Alt+W closes the focused pane alone', async ({
  workspace,
  repo,
  tabShortcuts,
}) => {
  const path = repo.readme.path;
  const tab = new RegExp(path);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace
    .getByRole('tab', { name: tab, exact: true })
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
  await expect
    .element(left.getByRole('tab', { name: tab, exact: true }))
    .toBeVisible();
  await right.getByRole('tab', { name: tab, exact: true }).click();
  await expect(tabShortcuts.registerDuplicate()).rejects.toThrow(
    new Error(
      "'Alt+W' is already registered. Use conflictBehavior: 'replace' to replace the existing handler, or conflictBehavior: 'allow' to allow multiple registrations.",
    ),
  );
  await expect
    .poll(() => tabShortcuts.registered())
    .toEqual([
      ['Alt+ArrowLeft', 'error'],
      ['Alt+ArrowRight', 'error'],
      ['Alt+W', 'error'],
      ['Alt+\\', 'error'],
    ]);

  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect.element(right).not.toBeInTheDocument();
  await expect
    .element(workspace.getByRole('tab', { name: tab, exact: true }))
    .toBeVisible();
});

test('split published reviews keep one walkthrough shortcut owner as focus changes', async ({
  workspace,
  agent,
  tabShortcuts,
}) => {
  await agent.publishArchitecture();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  const drawer = workspace.getByRole('dialog', {
    name: 'Worktree review',
    exact: true,
  });
  await drawer.getByRole('tab', { name: 'Review', exact: true }).click();
  await drawer
    .getByRole('button', {
      name: '3 Publish an immutable note 0/6',
      exact: true,
    })
    .click();
  await expect
    .element(
      workspace.getByRole('region', {
        name: '3. Publish an immutable note',
        exact: true,
      }),
    )
    .toBeVisible();
  await workspace
    .getByRole('tablist', { name: 'Open documents', exact: true })
    .getByRole('tab', { name: 'Review', exact: true })
    .click({ button: 'right' });
  await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  const left = workspace.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  await right.getByRole('tab', { name: 'Review', exact: true }).click();
  await expect
    .poll(() => tabShortcuts.registered(['N', 'P', 'R']))
    .toEqual([
      ['N', 'error'],
      ['P', 'error'],
      ['R', 'error'],
    ]);
  await userEvent.keyboard('n');
  await expect
    .element(
      right.getByRole('region', {
        name: '4. Export history without blocking writes',
        exact: true,
      }),
    )
    .toBeVisible();
  await left.getByRole('tab', { name: 'Review', exact: true }).click();
  await userEvent.keyboard('p');
  await expect
    .element(
      left.getByRole('region', {
        name: '3. Publish an immutable note',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .poll(() => tabShortcuts.registered(['N', 'P', 'R']))
    .toEqual([
      ['N', 'error'],
      ['P', 'error'],
      ['R', 'error'],
    ]);
  await right
    .getByRole('tab', { name: 'Review', exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Close pane', exact: true })
    .click();
  await expect.element(right).not.toBeInTheDocument();
  await expect
    .element(
      workspace
        .getByRole('tablist', { name: 'Open documents', exact: true })
        .getByRole('tab', { name: 'Review', exact: true }),
    )
    .toBeVisible();
});
