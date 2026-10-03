import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('in a split view Alt+W closes the tab of the focused pane alone, and opening the split registers the tab shortcuts once', async ({
  workspace,
  repo,
}) => {
  const warnings: string[] = [];
  const warn = console.warn.bind(console);
  console.warn = (...values: unknown[]) => {
    warnings.push(values.map(String).join(' '));
    warn(...values);
  };
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

  await userEvent.keyboard('{Alt>}w{/Alt}');
  await expect.element(right).not.toBeInTheDocument();
  await expect
    .element(workspace.getByRole('tab', { name: tab, exact: true }))
    .toBeVisible();
  await expect
    .poll(() => warnings.filter((line) => line.includes('already registered')))
    .toEqual([]);
});
