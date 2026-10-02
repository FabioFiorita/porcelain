import { expect, test } from './fixtures.ts';

test('turning on Spec files in Settings lists changed spec files after the other changed files', async ({
  page,
  pairedPage,
  repo,
}) => {
  await repo.write('search.spec.ts', 'export const spec = true;\n');
  await repo.write('search.ts', 'export const search = true;\n');
  const rows = pairedPage.getByRole('button', {
    name: /^(README\.md|search\.spec\.ts|search\.ts)( · .+)?$/,
  });
  const listed = async (names: readonly RegExp[]) => {
    for (const [index, name] of names.entries())
      await expect(rows.nth(index)).toHaveAccessibleName(name);
  };
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Changes', exact: true }).click();
  await listed([/^README\.md/, /^search\.spec\.ts/, /^search\.ts/]);

  page.keyboard.press('Escape');
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await settings
    .getByRole('switch', { name: 'Spec files', exact: true })
    .click();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await listed([/^README\.md/, /^search\.ts/, /^search\.spec\.ts/]);
});
