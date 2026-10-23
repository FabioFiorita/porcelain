import { savedPreferences } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('the commit picker remembers the last model after reloading', async ({
  pairedPage,
  codingTool,
  app,
}) => {
  await codingTool.install();
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  const picker = dialog.getByRole('combobox', {
    name: 'Commit model',
    exact: true,
  });
  await expect(picker).toBeEnabled();
  await picker.click();
  await pairedPage.getByRole('option', { name: 'Haiku', exact: true }).click();
  await expect(picker).toContainText('Haiku');
  await expect
    .poll(() => savedPreferences(pairedPage))
    .toMatchObject({ commitModel: 'claude:haiku' });
  await app.reload();
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect(picker).toContainText('Haiku');
});
