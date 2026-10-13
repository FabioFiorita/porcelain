import { expect, test } from './fixtures.ts';

test('Spec files creates a separate collapsed section only while the setting is on', async ({
  page,
  pairedPage,
  repo,
  server,
}) => {
  await repo.write('search.spec.ts', 'export const spec = true;\n');
  await repo.write('search.ts', 'export const search = true;\n');
  const rows = pairedPage.getByRole('button', {
    name: /^(README\.md|search\.spec\.ts|search\.ts)( · .+)?$/,
  });
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Changes', exact: true }).click();
  for (const [index, name] of [
    /^README\.md/,
    /^search\.spec\.ts/,
    /^search\.ts/,
  ].entries())
    await expect(rows.nth(index)).toHaveAccessibleName(name);

  await expect(
    pairedPage.getByText('Specs · 1 files', { exact: true }),
  ).not.toBeVisible();
  await page.keyboard.press('Escape');
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
  await expect(
    pairedPage.getByRole('button', { name: /^search\.spec\.ts/ }),
  ).not.toBeVisible();
  await pairedPage
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByText('Specs · 1 files', { exact: true })
    .click();
  await expect(
    pairedPage.getByRole('button', { name: 'Open all specs', exact: true }),
  ).toBeVisible();
  await expect(rows.nth(2)).toHaveAccessibleName(/^search\.spec\.ts/);
  await pairedPage
    .getByRole('button', { name: 'Open all specs', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('heading', { name: 'Specs', exact: true }),
  ).toBeVisible();
  await pairedPage
    .getByRole('button', { name: 'Mark all 1 files reviewed', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.reviewedFiles()).marks.map((mark) => mark.path),
    )
    .toEqual(['search.spec.ts']);
});
