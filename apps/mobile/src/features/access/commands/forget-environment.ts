import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom } from '@effect/atom-react';
import { EnvironmentCommands } from '@porcelain/client/access';
import type { Remote } from '@porcelain/client/access/rules';
import { clientRuntime } from '../../../shared/application/store';

const forgetEnvironment = Atom.family((environmentId: string) =>
  clientRuntime.fn((_: void) =>
    Effect.gen(function* () {
      const commands = yield* EnvironmentCommands;
      yield* commands.forget(environmentId);
    }),
  ),
);

export function useForgetEnvironment(remote: Remote) {
  const [result, run] = useAtom(forgetEnvironment(remote.environmentId));
  return { result, forget: () => run(undefined) };
}
