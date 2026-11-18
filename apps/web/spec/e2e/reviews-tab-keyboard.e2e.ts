import { expect, test } from './fixtures.ts';

test('Alt+W keeps the permanent Review tab active beside a file', async ({
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
  const permanent = tabs.getByRole('tab', { name: 'Review', exact: true });
  await permanent.click();
  await expect
    .poll(() => new URLSearchParams(app.address().query).get('entry'))
    .toBe('review');
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

for (const entry of ['handoff', 'walkthrough']) {
  test(`an old ${entry} link lands on the one Review tab`, async ({
    pairedPage: page,
    app,
  }) => {
    await app.open(`${app.address().path}?entry=${entry}`);
    const tabs = page.getByRole('tablist', {
      name: 'Open documents',
      exact: true,
    });
    await expect(tabs.getByRole('tab')).toHaveText(['Review']);
    await expect(
      tabs.getByRole('tab', { name: 'Review', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect
      .poll(() => new URLSearchParams(app.address().query).get('entry'))
      .toBe('review');
  });
}
