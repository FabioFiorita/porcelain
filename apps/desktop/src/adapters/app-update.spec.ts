import { EventEmitter } from 'node:events';
import { expect, it } from '@effect/vitest';
import { Deferred, Effect, Exit, Fiber } from 'effect';
import type { DesktopAppUpdateState } from '@porcelain/contracts/desktop';
import { openAppUpdate, type Updater } from './app-update.ts';

function release(check: Updater['checkForUpdates']) {
  const events = new EventEmitter();
  const calls = { checks: 0, downloads: 0, installs: 0 };
  const downloadStarted = Deferred.makeUnsafe<void>();
  let download = (): Promise<unknown> => new Promise(() => undefined);
  function on(event: 'error', listener: (error: Error) => void): EventEmitter;
  function on(
    event: 'update-downloaded',
    listener: (info: { version: string }) => void,
  ): EventEmitter;
  function on(
    event: 'error' | 'update-downloaded',
    listener: ((error: Error) => void) | ((info: { version: string }) => void),
  ) {
    return events.on(event, listener);
  }
  const updater: Updater = {
    checkForUpdates: () => {
      calls.checks += 1;
      return check();
    },
    downloadUpdate: () => {
      calls.downloads += 1;
      Deferred.doneUnsafe(downloadStarted, Effect.void);
      return download();
    },
    quitAndInstall: () => {
      calls.installs += 1;
    },
    on,
  };
  return {
    updater,
    events,
    calls,
    downloadStarted: Deferred.await(downloadStarted),
    failDownload: (message: string) => {
      download = () => Promise.reject(new Error(message));
    },
  };
}

const newer = () =>
  Promise.resolve({
    isUpdateAvailable: true,
    updateInfo: { version: '0.66.0' },
  });

it.effect(
  'reports that a local build has no update feed, before and after a check',
  () =>
    Effect.gen(function* () {
      const states: DesktopAppUpdateState[] = [];
      const update = openAppUpdate(undefined, (state) => states.push(state));
      expect(update.read()).toEqual({ status: 'unavailable' });
      expect(yield* update.check()).toEqual({ available: null });
      expect(states).toEqual([
        { status: 'checking' },
        { status: 'unavailable' },
      ]);
      expect(update.read()).toEqual({ status: 'unavailable' });
    }),
);

it.effect(
  'refuses to install in a local build and publishes why, until a later check clears it',
  () =>
    Effect.gen(function* () {
      const states: DesktopAppUpdateState[] = [];
      const update = openAppUpdate(undefined, (state) => states.push(state));
      const refused = yield* Effect.flip(update.install());
      expect(refused.message).toBe(
        'App updates are unavailable for this local build',
      );
      expect(states).toEqual([
        {
          status: 'error',
          message: 'App updates are unavailable for this local build',
        },
      ]);
      expect(yield* update.check()).toEqual({ available: null });
      expect(update.read()).toEqual({ status: 'unavailable' });
    }),
);

it.effect('offers the newer release a check finds, with its version', () =>
  Effect.gen(function* () {
    const states: DesktopAppUpdateState[] = [];
    const { updater, calls } = release(newer);
    const update = openAppUpdate(updater, (state) => states.push(state));
    expect(update.read()).toEqual({ status: 'idle' });
    expect(yield* update.check()).toEqual({ available: '0.66.0' });
    expect(states).toEqual([
      { status: 'checking' },
      { status: 'available', version: '0.66.0' },
    ]);
    expect(calls.downloads).toBe(0);
  }),
);

it.effect(
  'returns to idle when the running version is the newest release',
  () =>
    Effect.gen(function* () {
      const states: DesktopAppUpdateState[] = [];
      const { updater } = release(() =>
        Promise.resolve({
          isUpdateAvailable: false,
          updateInfo: { version: '0.65.1' },
        }),
      );
      const update = openAppUpdate(updater, (state) => states.push(state));
      expect(yield* update.check()).toEqual({ available: null });
      expect(states).toEqual([{ status: 'checking' }, { status: 'idle' }]);
    }),
);

it.effect(
  'shows why a check failed instead of reporting the newest version',
  () =>
    Effect.gen(function* () {
      const states: DesktopAppUpdateState[] = [];
      const { updater } = release(() =>
        Promise.reject(new Error('HttpError: 404 latest-mac.yml')),
      );
      const update = openAppUpdate(updater, (state) => states.push(state));
      expect(yield* update.check()).toEqual({ available: null });
      expect(states).toEqual([
        { status: 'checking' },
        { status: 'error', message: 'HttpError: 404 latest-mac.yml' },
      ]);
    }),
);

it.effect(
  'downloads the offered release and restarts into it only once it is downloaded',
  () =>
    Effect.gen(function* () {
      const states: DesktopAppUpdateState[] = [];
      const { updater, events, calls, downloadStarted } = release(newer);
      const update = openAppUpdate(updater, (state) => states.push(state));
      yield* update.check();
      const installing = yield* Effect.forkChild(update.install());
      yield* downloadStarted;
      expect(update.read()).toEqual({
        status: 'downloading',
        version: '0.66.0',
      });
      expect(calls).toEqual({ checks: 1, downloads: 1, installs: 0 });
      events.emit('update-downloaded', { version: '0.66.0' });
      yield* Fiber.join(installing);
      expect(states.slice(2)).toEqual([
        { status: 'downloading', version: '0.66.0' },
        { status: 'ready', version: '0.66.0' },
        { status: 'installing', version: '0.66.0' },
      ]);
      expect(calls).toEqual({ checks: 1, downloads: 1, installs: 1 });
    }),
);

it.effect('publishes a failed download and does not restart', () =>
  Effect.gen(function* () {
    const { updater, calls, failDownload } = release(newer);
    const update = openAppUpdate(updater, () => undefined);
    yield* update.check();
    failDownload('net::ERR_CONNECTION_RESET');
    const failed = yield* Effect.flip(update.install());
    expect(failed.message).toBe('net::ERR_CONNECTION_RESET');
    expect(update.read()).toEqual({
      status: 'error',
      message: 'net::ERR_CONNECTION_RESET',
    });
    expect(calls.installs).toBe(0);
  }),
);

it.effect('ends a download that the updater reports as failed', () =>
  Effect.gen(function* () {
    const { updater, events, calls, downloadStarted } = release(newer);
    const update = openAppUpdate(updater, () => undefined);
    yield* update.check();
    const installing = yield* Effect.forkChild(Effect.flip(update.install()));
    yield* downloadStarted;
    events.emit('error', new Error('Code signature did not match'));
    yield* Effect.yieldNow;
    expect(installing.pollUnsafe()?._tag).toBe('Success');
    expect((yield* Fiber.join(installing)).message).toBe(
      'Code signature did not match',
    );
    expect(update.read()).toEqual({
      status: 'error',
      message: 'Code signature did not match',
    });
    expect(calls.installs).toBe(0);
  }),
);

it.effect('does not download before a check has offered a release', () =>
  Effect.gen(function* () {
    const { updater, calls } = release(newer);
    const update = openAppUpdate(updater, () => undefined);
    const refused = yield* Effect.flip(update.install());
    expect(refused.message).toBe(
      'Check for an app update before installing it',
    );
    expect(calls.downloads).toBe(0);
  }),
);

it.effect(
  'keeps the download and its completion when a renderer checks again and installs twice',
  () =>
    Effect.gen(function* () {
      const states: DesktopAppUpdateState[] = [];
      const { updater, events, calls, downloadStarted } = release(newer);
      const update = openAppUpdate(updater, (state) => states.push(state));
      yield* update.check();
      const first = yield* Effect.forkChild(update.install());
      yield* downloadStarted;
      expect(yield* update.check()).toEqual({ available: '0.66.0' });
      expect(update.read()).toEqual({
        status: 'downloading',
        version: '0.66.0',
      });
      expect(states).toEqual([
        { status: 'checking' },
        { status: 'available', version: '0.66.0' },
        { status: 'downloading', version: '0.66.0' },
      ]);
      const second = yield* Effect.forkChild(update.install(), {
        startImmediately: true,
      });
      expect(calls).toEqual({ checks: 1, downloads: 1, installs: 0 });
      expect(second.pollUnsafe()).toEqual(Exit.void);
      yield* Fiber.join(second);
      events.emit('update-downloaded', { version: '0.66.0' });
      yield* Fiber.join(first);
      expect(calls).toEqual({ checks: 1, downloads: 1, installs: 1 });
      expect(states.slice(3)).toEqual([
        { status: 'ready', version: '0.66.0' },
        { status: 'installing', version: '0.66.0' },
      ]);
      yield* update.install();
      expect(calls.installs).toBe(1);
    }),
);

it.effect(
  'refuses a second install during a download without starting another download',
  () =>
    Effect.gen(function* () {
      const { updater, events, calls, downloadStarted } = release(newer);
      const update = openAppUpdate(updater, () => undefined);
      yield* update.check();
      const first = yield* Effect.forkChild(update.install());
      yield* downloadStarted;
      const second = yield* Effect.forkChild(update.install(), {
        startImmediately: true,
      });
      expect(calls.downloads).toBe(1);
      expect(second.pollUnsafe()).toEqual(Exit.void);
      yield* Fiber.join(second);
      events.emit('update-downloaded', { version: '0.66.0' });
      yield* Fiber.join(first);
      expect(calls.installs).toBe(1);
    }),
);

it.effect(
  'keeps ready and installing states when a renderer checks for updates',
  () =>
    Effect.gen(function* () {
      const states: DesktopAppUpdateState[] = [];
      const { updater, events, calls, downloadStarted } = release(newer);
      const update = openAppUpdate(updater, (state) => {
        states.push(state);
        if (state.status === 'ready' || state.status === 'installing') {
          const checking = Effect.runFork(update.check());
          try {
            expect(checking.pollUnsafe()).toEqual(
              Exit.succeed({ available: '0.66.0' }),
            );
          } finally {
            checking.interruptUnsafe();
          }
        }
      });
      yield* update.check();
      const installing = yield* Effect.forkChild(update.install());
      yield* downloadStarted;
      events.emit('update-downloaded', { version: '0.66.0' });
      yield* Fiber.join(installing);
      expect(calls).toEqual({ checks: 1, downloads: 1, installs: 1 });
      expect(states.slice(2)).toEqual([
        { status: 'downloading', version: '0.66.0' },
        { status: 'ready', version: '0.66.0' },
        { status: 'installing', version: '0.66.0' },
      ]);
    }),
);

it.effect(
  'reports a null check result as unavailable and clears a previously offered release',
  () =>
    Effect.gen(function* () {
      let result: Awaited<ReturnType<Updater['checkForUpdates']>> = {
        isUpdateAvailable: true,
        updateInfo: { version: '0.66.0' },
      };
      const { updater, calls } = release(() => Promise.resolve(result));
      const states: DesktopAppUpdateState[] = [];
      const update = openAppUpdate(updater, (state) => states.push(state));
      yield* update.check();
      result = null;
      expect(yield* update.check()).toEqual({ available: null });
      expect(states.slice(2)).toEqual([
        { status: 'checking' },
        { status: 'unavailable' },
      ]);
      expect(update.read()).toEqual({ status: 'unavailable' });
      const refused = yield* Effect.flip(update.install());
      expect(refused.message).toBe(
        'Check for an app update before installing it',
      );
      expect(calls.downloads).toBe(0);
    }),
);

function delayedCheck() {
  const answer =
    Promise.withResolvers<Awaited<ReturnType<Updater['checkForUpdates']>>>();
  let checks = 0;
  return {
    ...release(() => (++checks === 1 ? newer() : answer.promise)),
    answer,
  };
}

it.effect(
  'keeps the download when an earlier check finishes with available',
  () =>
    Effect.gen(function* () {
      const { updater, events, calls, downloadStarted, answer } =
        delayedCheck();
      const update = openAppUpdate(updater, () => undefined);
      yield* update.check();
      const checking = yield* Effect.forkChild(update.check(), {
        startImmediately: true,
      });
      expect(update.read()).toEqual({ status: 'checking' });
      const installing = yield* Effect.forkChild(update.install());
      yield* downloadStarted;
      answer.resolve({
        isUpdateAvailable: true,
        updateInfo: { version: '0.67.0' },
      });
      expect(yield* Fiber.join(checking)).toEqual({ available: '0.66.0' });
      expect(update.read()).toEqual({
        status: 'downloading',
        version: '0.66.0',
      });
      events.emit('update-downloaded', { version: '0.66.0' });
      yield* Fiber.join(installing);
      expect(calls).toEqual({ checks: 2, downloads: 1, installs: 1 });
    }),
);

it.effect('keeps the download when an earlier check finishes with null', () =>
  Effect.gen(function* () {
    const { updater, events, calls, downloadStarted, answer } = delayedCheck();
    const update = openAppUpdate(updater, () => undefined);
    yield* update.check();
    const checking = yield* Effect.forkChild(update.check(), {
      startImmediately: true,
    });
    expect(update.read()).toEqual({ status: 'checking' });
    const installing = yield* Effect.forkChild(update.install());
    yield* downloadStarted;
    answer.resolve(null);
    expect(yield* Fiber.join(checking)).toEqual({ available: '0.66.0' });
    expect(update.read()).toEqual({ status: 'downloading', version: '0.66.0' });
    events.emit('update-downloaded', { version: '0.66.0' });
    yield* Fiber.join(installing);
    expect(calls).toEqual({ checks: 2, downloads: 1, installs: 1 });
  }),
);

it.effect('keeps the download when an earlier check finishes with error', () =>
  Effect.gen(function* () {
    const { updater, events, calls, downloadStarted, answer } = delayedCheck();
    const update = openAppUpdate(updater, () => undefined);
    yield* update.check();
    const checking = yield* Effect.forkChild(update.check(), {
      startImmediately: true,
    });
    expect(update.read()).toEqual({ status: 'checking' });
    const installing = yield* Effect.forkChild(update.install());
    yield* downloadStarted;
    answer.reject(new Error('Feed offline'));
    expect(yield* Fiber.join(checking)).toEqual({ available: '0.66.0' });
    expect(update.read()).toEqual({ status: 'downloading', version: '0.66.0' });
    events.emit('update-downloaded', { version: '0.66.0' });
    yield* Fiber.join(installing);
    expect(calls).toEqual({ checks: 2, downloads: 1, installs: 1 });
  }),
);
