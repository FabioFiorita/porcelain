import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { DesktopBridge } from '@porcelain/contracts/desktop';
import {
  expect,
  savedCredentials,
  test,
  writeCredentials,
} from './fixtures.ts';

declare const porcelainDesktop: DesktopBridge;

declare const powerProof: {
  events: string[];
  unsubscribe: () => void;
  delivered: Promise<void>;
};

test('native suspend and resume reach the renderer through removable validated subscriptions', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await page.evaluate(() => {
    const events: string[] = [];
    const unsubscribe = porcelainDesktop.onPowerState((state) =>
      events.push(state),
    );
    Reflect.set(globalThis, 'powerProof', {
      events,
      unsubscribe,
      delivered: Promise.resolve(),
    });
  });
  await app.electron.evaluate(({ BrowserWindow, powerMonitor }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send(
      'porcelain:power-state',
      'invalid',
    );
    powerMonitor.emit('suspend');
    powerMonitor.emit('resume');
  });
  await expect
    .poll(() => page.evaluate(() => powerProof.events))
    .toEqual(['suspend', 'resume']);
  await page.evaluate(() => {
    powerProof.unsubscribe();
    powerProof.delivered = new Promise<void>((resolve) => {
      const stop = porcelainDesktop.onPowerState((state) => {
        if (state === 'resume') {
          stop();
          resolve();
        }
      });
    });
  });
  await app.electron.evaluate(({ powerMonitor }) => {
    powerMonitor.emit('suspend');
    powerMonitor.emit('resume');
  });
  expect(
    await page.evaluate(async () => {
      await powerProof.delivered;
      return powerProof.events;
    }),
  ).toEqual(['suspend', 'resume']);
});

const saved = JSON.stringify([
  { name: 'Desktop proof', credential: 'test-only-bearer' },
]);

test('the bridge keeps one opaque credential string encrypted in a file only the owner reads, and restores it after a restart @macos', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  expect(await savedCredentials(page)).toEqual({ status: 'empty' });
  expect(await writeCredentials(page, saved)).toBe('');
  expect(await savedCredentials(page)).toEqual({
    status: 'saved',
    value: saved,
  });
  expect(
    (await readFile(app.credentialsFile)).includes(
      Buffer.from('test-only-bearer'),
    ),
  ).toBe(false);
  expect((await stat(app.credentialsFile)).mode & 0o777).toBe(0o600);
  await app.quit();

  const restarted = await desktop.launch();
  expect(await savedCredentials(await restarted.window())).toEqual({
    status: 'saved',
    value: saved,
  });
});

test('credentials the app cannot decrypt read as unreadable, are never saved over, and Settings says they could not be read @macos', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  expect(await writeCredentials(page, saved)).toBe('');
  const encrypted = await readFile(app.credentialsFile);
  await app.electron.evaluate(({ safeStorage }) => {
    safeStorage.decryptStringAsync = () =>
      Promise.reject(new Error('Keychain access denied'));
  });
  expect(await savedCredentials(page)).toEqual({
    status: 'unreadable',
    message: 'The saved credentials could not be read: Keychain access denied',
  });
  expect(await writeCredentials(page, '[]')).toContain('kept unchanged');
  expect(await readFile(app.credentialsFile)).toEqual(encrypted);

  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await expect(
    settings.getByText('Saved computers could not be read', {
      exact: true,
    }),
  ).toBeVisible();
  expect(await readFile(app.credentialsFile)).toEqual(encrypted);
});

test('with encryption unavailable a write is refused and the saved ciphertext stays, and clear still removes the saved credentials @macos', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  expect(await writeCredentials(page, saved)).toBe('');
  const encrypted = await readFile(app.credentialsFile);
  await app.electron.evaluate(({ safeStorage }) => {
    safeStorage.isAsyncEncryptionAvailable = () => Promise.resolve(false);
  });
  expect(await writeCredentials(page, 'must-not-be-stored')).toContain(
    'Encrypted credential storage is unavailable',
  );
  expect(await readFile(app.credentialsFile)).toEqual(encrypted);
  await page.evaluate(() => porcelainDesktop.credentials.clear());
  expect(await savedCredentials(page)).toEqual({ status: 'empty' });
  expect(existsSync(app.credentialsFile)).toBe(false);
});

test('the bridge gives the app version at once, reports through removable subscriptions that the local build has no update feed, and refuses to install', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  const version = await app.electron.evaluate(({ app }) => app.getVersion());
  const updates = await page.evaluate(async () => {
    const bridge = porcelainDesktop.appUpdate;
    const states: string[] = [];
    let checking = false;
    const settled = Promise.withResolvers<void>();
    const unsubscribe = bridge.onState((state) => {
      states.push(state.status);
      if (state.status === 'checking') checking = true;
      if (checking && state.status === 'unavailable') settled.resolve();
    });
    await bridge.check();
    await settled.promise;
    unsubscribe();
    const observed = [...states];
    const installError = await bridge.install().then(
      () => '',
      (error: unknown) => (error instanceof Error ? error.message : ''),
    );
    await bridge.check();
    return {
      current: bridge.current(),
      observed,
      afterUnsubscribe: states.slice(observed.length),
      installError,
    };
  });
  expect(updates.current).toBe(version);
  expect(updates.observed).toContain('checking');
  expect(updates.observed.at(-1)).toBe('unavailable');
  expect(updates.afterUnsubscribe).toEqual([]);
  expect(updates.installError).toContain('unavailable for this local build');
});
