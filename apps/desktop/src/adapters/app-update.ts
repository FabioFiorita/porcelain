import { Data, Deferred, Effect } from 'effect';
import type {
  DesktopAppUpdateCheck,
  DesktopAppUpdateState,
} from '@porcelain/contracts/desktop';

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
  let available: string | undefined;
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
    downloading !== undefined ||
    state.status === 'downloading' ||
    state.status === 'ready' ||
    state.status === 'installing';
  const check = Effect.fn('AppUpdate.check')(
    function* (): Effect.fn.Return<DesktopAppUpdateCheck, AppUpdateError> {
      if (installationActive()) return { available: available ?? null };
      publish({ status: 'checking' });
      if (updater === undefined) {
        publish({ status: 'unavailable' });
        return { available: null };
      }
      const result = yield* Effect.tryPromise({
        try: () => updater.checkForUpdates(),
        catch: (error) => failure(error, 'Could not check for an app update'),
      });
      if (installationActive()) return { available: available ?? null };
      if (result === null) {
        available = undefined;
        publish({ status: 'unavailable' });
        return { available: null };
      }
      available = result.isUpdateAvailable
        ? result.updateInfo.version
        : undefined;
      publish(
        available === undefined
          ? { status: 'idle' }
          : { status: 'available', version: available },
      );
      return { available: available ?? null };
    },
    Effect.catch((error) =>
      Effect.sync((): DesktopAppUpdateCheck => {
        if (installationActive()) return { available: available ?? null };
        available = undefined;
        publish({ status: 'error', message: error.message });
        return { available: null };
      }),
    ),
  );
  const install = Effect.fn('AppUpdate.install')(
    function* () {
      if (updater === undefined)
        return yield* new AppUpdateError({ message: localBuild });
      const version = available;
      if (version === undefined)
        return yield* new AppUpdateError({
          message: 'Check for an app update before installing it',
        });
      if (installationActive()) return;
      publish({ status: 'downloading', version });
      const downloaded = yield* Deferred.make<void, AppUpdateError>();
      downloading = downloaded;
      yield* Deferred.await(downloaded).pipe(
        Effect.raceFirst(
          Effect.tryPromise({
            try: () => updater.downloadUpdate(),
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
      updater.quitAndInstall();
    },
    Effect.tapError((error) =>
      Effect.sync(() => publish({ status: 'error', message: error.message })),
    ),
  );
  return { read, check, install };
}
