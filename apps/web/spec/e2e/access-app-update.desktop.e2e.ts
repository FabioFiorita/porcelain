import type {
  DesktopBridge,
  DesktopAppUpdateState,
} from '@porcelain/contracts/desktop';
import { expect, test, type Page } from './fixtures.ts';

declare const window: {
  porcelainDesktop: DesktopBridge;
  updateFixture: {
    publish: (state: DesktopAppUpdateState) => void;
    answer: () => void;
    finish: (state: DesktopAppUpdateState) => void;
    refuseNext: () => void;
    checks: number;
  };
};

async function updateFeed(page: Page, enabled: boolean) {
  await page.addInitScript((enabled) => {
    let state: DesktopAppUpdateState = enabled
      ? { status: 'idle' }
      : { status: 'unavailable' };
    const listeners = new Set<(state: DesktopAppUpdateState) => void>();
    const publish = (next: DesktopAppUpdateState) => {
      state = next;
      for (const listener of listeners) listener(next);
    };
    let checked: (() => void) | undefined;
    let refused = false;
    window.updateFixture = {
      checks: 0,
      publish,
      answer: () => {
        checked?.();
        checked = undefined;
      },
      finish: (next) => {
        publish(next);
        window.updateFixture.answer();
      },
      refuseNext: () => {
        refused = true;
      },
    };
    window.porcelainDesktop = {
      appUpdate: {
        enabled: () => enabled,
        current: () => '0.65.4',
        check: () => {
          window.updateFixture.checks += 1;
          if (refused) {
            refused = false;
            return Promise.reject(new Error('The main process is gone'));
          }
          if (
            state.status === 'downloading' ||
            state.status === 'ready' ||
            state.status === 'installing'
          )
            return Promise.resolve();
          publish({ status: 'checking' });
          if (window.updateFixture.checks === 1) {
            publish(enabled ? { status: 'idle' } : { status: 'unavailable' });
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            checked = resolve;
          });
        },
        install: async () => {
          if (state.status === 'available')
            publish({ status: 'downloading', version: state.version });
        },
        onState: (receive) => {
          listeners.add(receive);
          receive(state);
          return () => {
            listeners.delete(receive);
          };
        },
      },
      pickProjectFolder: async () => null,
      credentials: {
        read: async () => ({ status: 'empty' }),
        write: async () => undefined,
        clear: async () => undefined,
      },
      liveAddress: () => '',
      isFullscreen: () => false,
      onFullscreen: () => () => undefined,
      onAction: () => () => undefined,
      setAppearance: () => undefined,
    };
  }, enabled);
}

async function openUpdates(page: Page) {
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('button', { name: 'This computer', exact: true })
    .click();
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
    settings.getByText('Porcelain app 0.66.0 is available.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('app-update-available.png'),
  });
  const install = settings.getByRole('button', {
    name: 'Update to 0.66.0',
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
    name: 'Update to 0.67.0',
    exact: true,
  });
  await expect(newer).toBeDisabled();
  await expect(install).not.toBeAttached();
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
    settings.getByText('Porcelain app 0.65.4', { exact: true }),
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
