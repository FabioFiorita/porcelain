import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('finding in a long file brings a match far below the fold into view in the file view and the editor', async ({
  pairedPage,
  repo,
}) => {
  const path = 'long.txt';
  const needle = 'the needle line near the end';
  const lines = Array.from({ length: 4000 }, (_, index) => `filler ${index}`);
  lines.splice(3900, 0, needle);
  lines.splice(20, 0, 'an early NEEDLE');
  await repo.write(path, `${lines.join('\n')}\n`);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = pairedPage.getByRole('treeitem', { name: path, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText('filler 0', { exact: true }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByText(needle, { exact: true }))
    .not.toBeInTheDocument();

  await userEvent.keyboard('{Control>}f{/Control}');
  const find = pairedPage.getByRole('textbox', {
    name: 'Find in file',
    exact: true,
  });
  await expect.element(find).toHaveFocus();
  await find.fill('needle');
  await expect
    .element(pairedPage.getByText('1 of 2', { exact: true }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByText('an early NEEDLE', { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Enter}');
  await expect
    .element(pairedPage.getByText('2 of 2', { exact: true }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByText(needle, { exact: true }))
    .toBeVisible();
  await pairedPage
    .getByRole('button', { name: 'Previous match', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText('1 of 2', { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(find).not.toBeInTheDocument();

  await pairedPage.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect
    .element(pairedPage.getByRole('textbox', { name: path, exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Control>}f{/Control}');
  const search = pairedPage.getByRole('textbox', {
    name: 'Search',
    exact: true,
  });
  await expect.element(search).toBeVisible();
  await search.fill(needle);
  await userEvent.keyboard('{Enter}');
  await expect
    .element(pairedPage.getByText(needle, { exact: true }).last())
    .toBeVisible();
});
