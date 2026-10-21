import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Effect, Option, Stream } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { DesktopHost } from '@/shared/adapters/desktop';

const runtime = Atom.runtime(DesktopHost.layer);
export const desktopCapabilities = runtime.atom(
  Effect.gen(function* () {
    const desktop = yield* DesktopHost;
    return {
      isDesktopShell: desktop.isDesktopShell,
      hasAppUpdateFeed: desktop.hasAppUpdateFeed,
    };
  }),
);
export const appUpdate = runtime
  .atom(
    Effect.gen(function* () {
      const desktop = yield* DesktopHost;
      return yield* desktop.checkUpdate;
    }),
  )
  .pipe(Atom.keepAlive);
export const appUpdateState = runtime
  .atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const desktop = yield* DesktopHost;
        return desktop.updateStates;
      }),
    ),
  )
  .pipe(Atom.setIdleTTL(0));

export function useAppUpdate() {
  return { result: useAtomValue(appUpdate), check: useAtomRefresh(appUpdate) };
}

export function useAppUpdateState() {
  const state = useAtomValue(appUpdateState);
  return Option.getOrElse(AsyncResult.value(state), () => ({
    status: 'idle' as const,
  }));
}

export function useDesktopCapabilities() {
  return useAtomValue(desktopCapabilities);
}
