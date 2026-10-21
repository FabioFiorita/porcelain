import { openThisComputer } from '../kit/settings.ts';
import { expect, serviceAheadTest as test } from './fixtures.ts';

for (const width of [1280, 414]) {
  test(`a server installed ahead of latest has no update badge or downgrade offer at ${width}px`, async ({
    pairedPage,
    app,
  }) => {
    await pairedPage.setViewportSize({ width, height: 896 });
    await app.reload();
    if (width === 414)
      await pairedPage
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
    const controls = pairedPage.getByRole('group', {
      name: 'Navigator controls',
      exact: true,
    });
    await expect(controls).toBeVisible();
    await expect(
      controls.getByRole('button', { name: 'Update', exact: true }),
    ).not.toBeAttached();
    await expect(
      pairedPage.getByText('Updates available', { exact: true }),
    ).not.toBeAttached();
    await pairedPage
      .getByRole('button', { name: 'Settings', exact: true })
      .click();
    const settings = await openThisComputer(pairedPage);
    await expect(
      settings.getByText('Porcelain 2.0.0', { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByText('Up to date', { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByText('Porcelain 2.0.0 → 1.1.0', { exact: true }),
    ).not.toBeAttached();
  });
}
