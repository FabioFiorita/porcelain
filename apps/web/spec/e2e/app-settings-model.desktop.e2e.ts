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

for (const via of ['keyboard', 'pointer'] as const) {
  test(`choosing the model the picker already shows saves it, by ${via}`, async ({
    pairedPage,
    codingTool,
  }) => {
    await codingTool.install();
    await pairedPage
      .getByRole('button', { name: 'Commit', exact: true })
      .click();
    const dialog = pairedPage.getByRole('dialog', {
      name: 'Commit changes',
      exact: true,
    });
    const picker = dialog.getByRole('combobox', {
      name: 'Commit model',
      exact: true,
    });
    await expect(picker).toBeEnabled();
    await expect(picker).not.toBeEmpty();
    const shown = (await picker.textContent())?.trim() ?? '';
    await expect
      .poll(() => savedPreferences(pairedPage))
      .toMatchObject({ commitModel: '' });
    if (via === 'keyboard') {
      await picker.focus();
      await pairedPage.keyboard.press('Enter');
      await expect(
        pairedPage.getByRole('option', { name: shown, exact: true }),
      ).toBeVisible();
      await pairedPage.keyboard.press('Enter');
    } else {
      await picker.click();
      await pairedPage
        .getByRole('option', { name: shown, exact: true })
        .click();
    }
    await expect(pairedPage.getByRole('listbox')).not.toBeAttached();
    await expect
      .poll(() => savedPreferences(pairedPage))
      .not.toMatchObject({ commitModel: '' });
  });
}
