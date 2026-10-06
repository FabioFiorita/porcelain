import { useAtomValue } from '@effect/atom-react';
import { Effect, Option, Stream } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { DesktopHost } from '@/shared/adapters/desktop';

const runtime = Atom.runtime(DesktopHost.layer);
const appUpdateCapability = runtime.atom(
  Effect.gen(function* () {
    const desktop = yield* DesktopHost;
    return desktop.hasAppUpdater;
  }),
);
const appUpdate = runtime
  .atom(
    Effect.gen(function* () {
      const desktop = yield* DesktopHost;
      return yield* desktop.checkUpdate;
    }),
  )
  .pipe(Atom.keepAlive);
const appUpdateState = runtime
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
  return useAtomValue(appUpdate);
}

export function useAppUpdateState() {
  const state = useAtomValue(appUpdateState);
  return Option.getOrElse(AsyncResult.value(state), () => ({
    status: 'idle' as const,
  }));
}

export function useAppUpdateCapability() {
  return useAtomValue(appUpdateCapability);
}
