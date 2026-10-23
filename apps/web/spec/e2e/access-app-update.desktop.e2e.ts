import { openThisComputer } from '../kit/settings.ts';
import { expect, test, type Page } from './fixtures.ts';
import {
  updateFeed,
  observeServiceUpdatePosts,
  type UpdateFixture,
} from '../kit/desktop-updates.ts';

declare const window: { updateFixture: UpdateFixture };
async function openUpdates(page: Page) {
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await openThisComputer(page);
  return settings;
}

test('the release app checks on demand, shows each result and installs the offered release', async ({
  page,
  app,
}, testInfo) => {
  await updateFeed(page, true);
  await app.open(await app.link('this'));
  const settings = await openUpdates(page);
  const check = settings.getByRole('button', {
    name: 'Check for updates',
    exact: true,
  });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(
    settings.getByText('Checking for a new version…', { exact: true }),
  ).toBeVisible();
  await expect(check).toBeDisabled();
  await page.evaluate(() => window.updateFixture.finish({ status: 'idle' }));
  await expect(
    settings.getByText('This is the newest version of the app.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(check).toBeEnabled();

  await page.evaluate(() => window.updateFixture.refuseNext());
  await check.click();
  await expect(
    settings.getByText('Could not check for an app update.', { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText('This is the newest version of the app.', {
      exact: true,
    }),
  ).not.toBeAttached();
  await expect(check).toBeEnabled();

  await check.click();
  await expect(
    settings.getByText('Checking for a new version…', { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText('Could not check for an app update.', { exact: true }),
  ).not.toBeAttached();
  await page.evaluate(() =>
    window.updateFixture.finish({
      status: 'error',
      message: 'Release feed is offline',
    }),
  );
  await expect(
    settings.getByText('Release feed is offline', { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText('Could not check for an app update.', { exact: true }),
  ).not.toBeAttached();
  await expect(
    settings.getByText('This is the newest version of the app.', {
      exact: true,
    }),
  ).not.toBeAttached();
  await expect(check).toBeEnabled();

  await check.click();
  await page.evaluate(() =>
    window.updateFixture.finish({ status: 'available', version: '0.66.0' }),
  );
  await expect(
    settings.getByText('Release feed is offline', { exact: true }),
  ).not.toBeAttached();
  await expect(
    settings.getByText('Mac app 0.65.4 → 0.66.0', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('app-update-available.png'),
  });
  const install = settings.getByRole('button', {
    name: 'Restart to update',
    exact: true,
  });
  await check.click();
  await expect(
    settings.getByText('Checking for a new version…', { exact: true }),
  ).toBeVisible();
  await expect(install).not.toBeAttached();
  await expect(check).toBeDisabled();
  await page.evaluate(() =>
    window.updateFixture.publish({ status: 'available', version: '0.67.0' }),
  );
  const newer = settings.getByRole('button', {
    name: 'Restart to update',
    exact: true,
  });
  await expect(newer).not.toBeAttached();
  await expect(
    settings.getByText('This is the newest version of the app.', {
      exact: true,
    }),
  ).not.toBeAttached();
  await page.evaluate(() => window.updateFixture.answer());
  await expect(newer).toBeEnabled();
  await newer.click();
  await expect(
    settings.getByText('Downloading 0.67.0…', { exact: true }),
  ).toBeVisible();
  await expect(check).toBeDisabled();
  await expect(newer).not.toBeAttached();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(settings).not.toBeAttached();
});

test('a desktop build with updates disabled hides the check control', async ({
  page,
  app,
}) => {
  await updateFeed(page, false);
  await app.open(await app.link('this'));
  const settings = await openUpdates(page);
  await expect(
    settings.getByText('Mac app 0.65.4', { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText(
      'This build updates by reinstalling; there is no update feed yet.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', { name: 'Check for updates', exact: true }),
  ).not.toBeAttached();
});

test('the footer Update badge offers the Mac app through its bridge without posting a service update', async ({
  page,
  app,
}) => {
  const servicePosts = observeServiceUpdatePosts(page);
  await updateFeed(page, true);
  await app.open(await app.link('this'));
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.evaluate(() =>
    window.updateFixture.publish({ status: 'available', version: '0.66.0' }),
  );
  const navigator = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const footer = navigator.getByRole('group', {
    name: 'Navigator controls',
    exact: true,
  });
  const pill = footer.getByRole('button', { name: 'Update', exact: true });
  await expect(
    footer.getByRole('button', { name: 'Settings', exact: true }),
  ).toBeVisible();
  await expect(
    footer.getByRole('button', { name: 'Keyboard shortcuts', exact: true }),
  ).toBeVisible();
  await expect(
    footer.getByRole('button', { name: 'Computers', exact: true }),
  ).not.toBeAttached();
  await expect(pill).toBeVisible();
  await expect(pill).toHaveText('Update');
  const shortcuts = footer.getByRole('button', {
    name: 'Keyboard shortcuts',
    exact: true,
  });
  const controls = [
    footer.getByRole('button', { name: 'Settings', exact: true }),
    pill,
    shortcuts,
  ];
  await expect
    .poll(async () => {
      const bounds = await Promise.all(
        controls.map((control) => control.boundingBox()),
      );
      const first = bounds[0];
      if (!first) return false;
      return bounds.every((box, index) => {
        if (!box) return false;
        const previous = bounds[index - 1];
        return (
          Math.abs(box.y + box.height / 2 - first.y - first.height / 2) < 1 &&
          (!previous || box.x >= previous.x + previous.width)
        );
      });
    })
    .toBe(true);
  await shortcuts.hover();
  await expect(page.getByRole('tooltip')).toContainText('Keyboard shortcuts');
  await pill.click();
  const updates = page.getByRole('dialog', {
    name: 'Updates available',
    exact: true,
  });
  await expect(updates).toBeVisible();
  await expect(updates).toHaveAttribute('data-side', 'top');
  await expect(
    updates.getByText('Mac app 0.65.4 → 0.66.0', { exact: true }),
  ).toBeVisible();
  await expect(
    updates.getByRole('button', { name: 'Update all (1)', exact: true }),
  ).toBeEnabled();
  await updates
    .getByRole('button', { name: 'Restart to update', exact: true })
    .click();
  await expect(
    updates.getByText('Downloading 0.66.0…', { exact: true }),
  ).toBeVisible();
  await expect(
    updates.getByRole('button', { name: 'Update all (0)', exact: true }),
  ).toBeDisabled();
  await expect.poll(servicePosts).toBe(0);
});
