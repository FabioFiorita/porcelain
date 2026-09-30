import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('the find count follows a file that changes on disk and stays within its matches', async ({
  pairedPage,
  repo,
}) => {
  const path = 'notes.txt';
  await repo.write(path, 'needle one\nneedle two\nneedle three\n');
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  await pairedPage
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText('needle three', { exact: true }))
    .toBeVisible();

  await userEvent.keyboard('{Control>}f{/Control}');
  await pairedPage
    .getByRole('textbox', { name: 'Find in file', exact: true })
    .fill('needle');
  await userEvent.keyboard('{Enter}{Enter}');
  await expect
    .element(pairedPage.getByText('3 of 3', { exact: true }))
    .toBeVisible();

  await repo.write(path, 'needle only\n');
  await expect
    .element(pairedPage.getByText('needle only', { exact: true }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByText('1 of 1', { exact: true }))
    .toBeVisible();
});
