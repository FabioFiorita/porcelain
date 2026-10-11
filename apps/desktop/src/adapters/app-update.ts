import { Data, Deferred, Effect } from 'effect';
import type { DesktopAppUpdateState } from '@porcelain/contracts/desktop';

export class AppUpdateError extends Data.TaggedError('AppUpdateError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

type Release = { readonly version: string };

export type Updater = {
  checkForUpdates: () => Promise<{
    readonly isUpdateAvailable: boolean;
    readonly updateInfo: Release;
  } | null>;
  downloadUpdate: () => Promise<unknown>;
  quitAndInstall: () => void;
  on: ((event: 'error', listener: (error: Error) => void) => unknown) &
    ((
      event: 'update-downloaded',
      listener: (info: Release) => void,
    ) => unknown);
};

const localBuild = 'App updates are unavailable for this local build';

function failure(error: unknown, fallback: string): AppUpdateError {
  return new AppUpdateError({
    message: error instanceof Error ? error.message : fallback,
    cause: error,
  });
}

export function openAppUpdate(
  updater: Updater | undefined,
  receive: (state: DesktopAppUpdateState) => void,
) {
  let state: DesktopAppUpdateState = { status: 'unavailable' };
  let downloading: Deferred.Deferred<void, AppUpdateError> | undefined;
  const publish = (next: DesktopAppUpdateState) => {
    state = next;
    receive(next);
  };
  if (updater !== undefined) {
    state = { status: 'idle' };
    updater.on('update-downloaded', () => {
      if (downloading !== undefined)
        Deferred.doneUnsafe(downloading, Effect.void);
    });
    updater.on('error', (error) => {
      publish({ status: 'error', message: error.message });
      if (downloading !== undefined)
        Deferred.doneUnsafe(
          downloading,
          Effect.fail(failure(error, 'The app update failed')),
        );
    });
  }
  const read = () => state;
  const installationActive = () =>
    state.status === 'downloading' ||
    state.status === 'ready' ||
    state.status === 'installing';
  const check = Effect.fn('AppUpdate.check')(
    function* (): Effect.fn.Return<void, AppUpdateError> {
      if (installationActive()) return;
      publish({ status: 'checking' });
      if (updater === undefined) {
        publish({ status: 'unavailable' });
        return;
      }
      const result = yield* Effect.tryPromise({
        try: () => updater.checkForUpdates(),
        catch: (error) => failure(error, 'Could not check for an app update'),
      });
      if (result === null) {
        publish({ status: 'unavailable' });
        return;
      }
      publish(
        result.isUpdateAvailable
          ? { status: 'available', version: result.updateInfo.version }
          : { status: 'idle' },
      );
    },
    Effect.catch((error) =>
      Effect.sync(() => {
        publish({ status: 'error', message: error.message });
      }),
    ),
  );
  const download = Effect.fn('AppUpdate.download')(
    function* (feed: Updater, version: string) {
      publish({ status: 'downloading', version });
      const downloaded = yield* Deferred.make<void, AppUpdateError>();
      downloading = downloaded;
      yield* Deferred.await(downloaded).pipe(
        Effect.raceFirst(
          Effect.tryPromise({
            try: () => feed.downloadUpdate(),
            catch: (error) => failure(error, 'The app update did not download'),
          }).pipe(Effect.andThen(Effect.never)),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            downloading = undefined;
          }),
        ),
      );
      publish({ status: 'ready', version });
      publish({ status: 'installing', version });
      feed.quitAndInstall();
    },
    Effect.tapError((error) =>
      Effect.sync(() => publish({ status: 'error', message: error.message })),
    ),
  );
  const install = Effect.fn('AppUpdate.install')(function* () {
    if (updater === undefined) {
      publish({ status: 'error', message: localBuild });
      return yield* new AppUpdateError({ message: localBuild });
    }
    if (installationActive()) return;
    if (state.status !== 'available')
      return yield* new AppUpdateError({
        message: 'Check for an app update before installing it',
      });
    yield* download(updater, state.version);
  });
  return { read, check, install };
}
