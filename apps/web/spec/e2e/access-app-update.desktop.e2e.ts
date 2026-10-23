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
  await page.evaluate(() => window.updateFixture.refuseNext());
  await check.click();
  await expect(
    settings.getByText('Could not check for an app update.', { exact: true }),
  ).toBeVisible();
  await expect(install).not.toBeAttached();
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

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`update errors remain readable and restore focus at ${width} in ${colorScheme}`, async ({
      page,
      app,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 896 });
      await page.emulateMedia({ colorScheme });
      await updateFeed(page, true);
      await app.open(await app.link('this'));
      const settings = page.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      await expect(settings).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => window.updateFixture.checks))
        .toBe(1);
      await page.evaluate(() =>
        window.updateFixture.publish({
          status: 'available',
          version: '0.66.0',
        }),
      );
      const badge = page.getByRole('button', { name: 'Update', exact: true });
      await badge.click();
      const updates = page.getByRole('dialog', { name: /updates/i });
      const retry = updates.getByRole('button', {
        name: 'Try again',
        exact: true,
      });
      for (const message of [
        `Feed refused request-id=${'unbrokenidentifier'.repeat(75)}`,
        'The release manifest could not be read. '.repeat(120),
      ]) {
        await page.evaluate(
          (message) =>
            window.updateFixture.publish({ status: 'error', message }),
          message,
        );
        await expect(
          updates.getByText(`Mac app: ${message}`, { exact: true }),
        ).toBeVisible();
        await expect
          .poll(() =>
            updates.evaluate(
              (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
          )
          .toBe(true);
        await retry.scrollIntoViewIfNeeded();
        await expect(retry).toBeInViewport();
        const manage = updates.getByRole('button', {
          name: 'Manage computers',
          exact: true,
        });
        await manage.scrollIntoViewIfNeeded();
        await expect(manage).toBeInViewport();
      }
      await page.screenshot({
        path: testInfo.outputPath('long-update-error.png'),
      });
      await page.keyboard.press('Escape');
      await expect(updates).not.toBeAttached();
      await expect(settings).toBeFocused();
      await expect(badge).not.toBeAttached();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('main', { name: 'Settings', exact: true }),
      ).toBeVisible();
      if (width === 414) {
        await expect(
          page.getByRole('dialog', { name: 'Sidebar', exact: true }),
        ).not.toBeAttached();
      }
    });
  }
}

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

for (const recovery of ['available', 'idle'] as const) {
  test(`the footer retries a failed Mac app check and recovers to ${recovery}`, async ({
    page,
    app,
  }, testInfo) => {
    await updateFeed(page, true);
    await app.open(await app.link('this'));
    await page
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.updateFixture.checks))
      .toBe(1);
    await page.evaluate(() =>
      window.updateFixture.publish({ status: 'available', version: '0.66.0' }),
    );
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    const updates = page.getByRole('dialog', {
      name: /^(Updates available|Could not check for updates|No updates available)$/,
    });
    await expect(updates).toHaveAccessibleName('Updates available');
    await expect
      .poll(() => page.evaluate(() => window.updateFixture.checks))
      .toBe(1);
    await page.evaluate(() =>
      window.updateFixture.publish({
        status: 'error',
        message: 'Release feed is offline',
      }),
    );
    await expect(updates).toHaveAccessibleName('Could not check for updates');
    const retry = updates.getByRole('button', {
      name: 'Try again',
      exact: true,
    });
    await retry.click();
    await expect
      .poll(() => page.evaluate(() => window.updateFixture.checks))
      .toBe(2);
    await expect(
      updates.getByRole('button', { name: 'Update all (0)', exact: true }),
    ).toBeDisabled();
    await expect(retry).not.toBeAttached();
    await page.evaluate(() =>
      window.updateFixture.finish({
        status: 'error',
        message: 'Release feed is still offline',
      }),
    );
    await expect(
      updates.getByText('Mac app: Release feed is still offline', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(retry).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('app-retry-error.png') });
    await retry.click();
    await expect
      .poll(() => page.evaluate(() => window.updateFixture.checks))
      .toBe(3);
    await page.evaluate(
      (status) =>
        window.updateFixture.finish(
          status === 'available' ? { status, version: '0.67.0' } : { status },
        ),
      recovery,
    );
    await expect(updates).toHaveAccessibleName(
      recovery === 'available' ? 'Updates available' : 'No updates available',
    );
    await expect(retry).not.toBeAttached();
    if (recovery === 'available') {
      await expect(
        updates.getByText('Mac app 0.65.4 → 0.67.0', { exact: true }),
      ).toBeVisible();
      await expect(
        updates.getByRole('button', { name: 'Update all (1)', exact: true }),
      ).toBeEnabled();
    } else {
      await expect(
        updates.getByRole('button', { name: 'Update all (0)', exact: true }),
      ).toBeDisabled();
    }
    await page.screenshot({
      path: testInfo.outputPath('app-retry-recovered.png'),
    });
    await updates
      .getByRole('button', { name: 'Manage computers', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Open This computer', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.updateFixture.checks))
      .toBe(3);
  });
}

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
