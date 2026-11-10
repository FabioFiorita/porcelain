import { expect, test } from './fixtures.ts';

for (const published of [false]) {
  test(`Alt+W keeps the permanent ${published ? 'Review' : 'Changes'} tab active beside a file`, async ({
    pairedPage: page,
    app,
    repo,
  }) => {
    await app.open(`${app.address().path}?entry=file:${repo.readme.path}`);
    const tabs = page.getByRole('tablist', {
      name: 'Open documents',
      exact: true,
    });
    const file = tabs.getByRole('tab', { name: repo.readme.path, exact: true });
    await expect(file).toHaveAttribute('aria-selected', 'true');
    const permanent = tabs.getByRole('tab', {
      name: published ? 'Review' : 'Changes',
      exact: true,
    });
    await permanent.click();
    await expect
      .poll(() => new URLSearchParams(app.address().query).get('entry'))
      .toBe('handoff');
    const address = page.url();
    await page.keyboard.press('Alt+w');
    await expect(permanent).toHaveAttribute('aria-selected', 'true');
    await expect(file).toHaveAttribute('aria-selected', 'false');
    await expect(page).toHaveURL(address);
    await file.click();
    await page.keyboard.press('Alt+w');
    await expect(file).not.toBeAttached();
    await expect(permanent).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Alt+w');
    await expect(permanent).toHaveAttribute('aria-selected', 'true');
  });
}
