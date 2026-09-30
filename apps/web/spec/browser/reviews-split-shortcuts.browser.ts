import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('in a split view Alt+W closes the tab of the focused pane alone, and opening the split registers the tab shortcuts once', async ({
  pairedPage,
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
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  await pairedPage
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await pairedPage
    .getByRole('tab', { name: tab, exact: true })
    .click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: /Open to the side/ }).click();
  const left = pairedPage.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  const right = pairedPage.getByRole('region', {
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
    .element(pairedPage.getByRole('tab', { name: tab, exact: true }))
    .toBeVisible();
  await expect
    .poll(() => warnings.filter((line) => line.includes('already registered')))
    .toEqual([]);
});
