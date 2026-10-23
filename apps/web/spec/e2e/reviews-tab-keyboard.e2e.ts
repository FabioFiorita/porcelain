import { expect, test } from './fixtures.ts';

for (const published of [false, true]) {
  test(`Alt+W keeps the permanent ${published ? 'Review' : 'Changes'} tab active beside a file`, async ({
    pairedPage: page,
    app,
    repo,
    agent,
  }) => {
    if (published) await agent.publishReview('Readme layer');
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

test('Git actions names its icon with a shared tooltip', async ({
  pairedPage: page,
}) => {
  const trigger = page.getByRole('button', {
    name: 'Git actions',
    exact: true,
  });
  await trigger.hover();
  await expect(
    page.getByRole('tooltip', { name: 'Git actions', exact: true }),
  ).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
