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

test('file tabs distinguish matching basenames by their full paths', async ({
  pairedPage: page,
  app,
  repo,
  agent,
}) => {
  await agent.publishArchitecture();
  await repo.write('docs/same.ts', 'export const side = "a";\n');
  await repo.write(
    'packages/workspace/src/same.ts',
    'export const side = "b";\n',
  );
  const query = new URLSearchParams({
    entry: 'file:docs/same.ts',
    side: 'file:packages/workspace/src/same.ts',
  });
  await app.open(`${app.address().path}?${query}`);
  const left = page.getByRole('region', { name: 'Left pane', exact: true });
  const right = page.getByRole('region', { name: 'Right pane', exact: true });
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  const first = left.getByRole('tab', { name: 'docs/same.ts', exact: true });
  const second = right.getByRole('tab', {
    name: 'packages/workspace/src/same.ts',
    exact: true,
  });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect(first).toHaveText('same.ts');
  await expect(second).toHaveText('same.ts');
});
