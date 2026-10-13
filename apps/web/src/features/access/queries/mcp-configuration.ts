import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Effect, Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { DesktopHost } from '@/shared/adapters/desktop';
import { desktopShell } from '@/shared/shell';

const mcpConfiguration = Atom.runtime(DesktopHost.layer).atom(
  Effect.gen(function* () {
    if (!desktopShell) return Option.none();
    const desktop = yield* DesktopHost;
    return Option.some(yield* desktop.mcpConfiguration);
  }),
);

export function useMcpConfiguration() {
  const result = useAtomValue(mcpConfiguration);
  return {
    configuration: Option.getOrUndefined(
      Option.flatten(AsyncResult.value(result)),
    ),
    failed: AsyncResult.isFailure(result),
    retry: useAtomRefresh(mcpConfiguration),
  };
}
