import { expect } from 'vitest';
import { test } from '../kit/journey';

test('without a coding CLI the commit dialog says drafting is unavailable, and a typed message still commits', async ({
  pairedPage,
  server,
}) => {
  const message = 'Commit written by hand';
  await expect.poll(() => server.commitModels()).toEqual([]);
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Commit changes' });
  const models = dialog.getByRole('combobox', { name: 'Commit model' });
  await expect.element(models).toBeDisabled();
  await expect.element(models).toHaveDisplayValue('No coding CLI available');
  await expect
    .element(dialog.getByRole('button', { name: 'Generate with AI' }))
    .toBeDisabled();
  await expect
    .element(dialog.getByRole('tab', { name: 'Use groups' }))
    .toBeDisabled();
  const commit = dialog.getByRole('button', { name: 'Commit selected files' });
  await expect.element(commit).toBeDisabled();

  await dialog.getByRole('textbox', { name: 'Message' }).fill(message);
  await expect.element(commit).toBeEnabled();
  await commit.click();
  await expect.element(dialog.getByText('succeeded')).toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(message);
});
