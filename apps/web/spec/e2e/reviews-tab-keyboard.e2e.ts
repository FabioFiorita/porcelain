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

test('Proof uses its pane bar and closes back to Review', async ({
  pairedPage: page,
  app,
  agent,
}) => {
  await agent.publishReview('Proof layer');
  await app.open(`${app.address().path}?entry=proof`);
  await expect(
    page.getByRole('heading', { name: 'Proof', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Git controls', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('tablist', { name: 'Open documents', exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press('Alt+\\');
  const right = page.getByRole('region', { name: 'Right pane', exact: true });
  await expect(right).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Git controls', exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press('Alt+w');
  await expect(right).not.toBeAttached();
  await expect(
    page
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Proof', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Alt+w');
  await expect(
    page
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Proof', exact: true }),
  ).not.toBeAttached();
  await expect(
    page
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Review', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('Escape closes Git actions while an action tooltip is open', async ({
  pairedPage: page,
}) => {
  const trigger = page.getByRole('button', {
    name: 'Git actions',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Commit…', exact: true }).hover();
  await expect(
    page.getByText('Commit selected files', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeAttached();
  await expect(trigger).toBeFocused();
});

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
