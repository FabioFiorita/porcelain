import { expect } from 'vitest';
import { test } from '../kit/journey';

test('without a coding CLI the commit dialog says drafting is unavailable, and a typed message still commits', async ({
  pairedPage,
  server,
}) => {
  const message = 'Commit written by hand';
  await expect.poll(() => server.commitModels()).toEqual([]);
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  const models = dialog.getByRole('combobox', {
    name: 'Commit model',
    exact: true,
  });
  await expect.element(models).toBeDisabled();
  await expect.element(models).toHaveDisplayValue('No coding CLI available');
  await expect
    .element(
      dialog.getByRole('button', { name: 'Generate with AI', exact: true }),
    )
    .toBeDisabled();
  await expect
    .element(dialog.getByRole('tab', { name: 'Use groups', exact: true }))
    .toBeDisabled();
  const commit = dialog.getByRole('button', {
    name: 'Commit selected files',
    exact: true,
  });
  await expect.element(commit).toBeDisabled();

  await dialog
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill(message);
  await expect.element(commit).toBeEnabled();
  await commit.click();
  await expect
    .element(dialog.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(message);
});
