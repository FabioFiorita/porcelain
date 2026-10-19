import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

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
      name: '3 Publish an immutable note',
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
    .getByRole('tab', { name: 'Review Close Review', exact: true })
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
  await right
    .getByRole('tab', { name: 'Review Close Review', exact: true })
    .click();
  await expect
    .poll(() => tabShortcuts.registered(['N', 'P']))
    .toEqual([
      ['N', 'error'],
      ['P', 'error'],
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
  await left
    .getByRole('tab', { name: 'Review Close Review', exact: true })
    .click();
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
    .poll(() => tabShortcuts.registered(['N', 'P']))
    .toEqual([
      ['N', 'error'],
      ['P', 'error'],
    ]);
});
