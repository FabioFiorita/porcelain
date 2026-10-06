import { useAtom } from '@effect/atom-react';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { DesktopHost } from '@/shared/adapters/desktop';

const installAppUpdate = Atom.runtime(DesktopHost.layer).fn((_: void) =>
  Effect.gen(function* () {
    const desktop = yield* DesktopHost;
    yield* desktop.installUpdate;
  }),
);

export function useInstallAppUpdate() {
  const [result, install] = useAtom(installAppUpdate);
  return { result, install: () => install(undefined) };
}
