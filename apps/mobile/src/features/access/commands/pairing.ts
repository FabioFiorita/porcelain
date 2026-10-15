import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom, useAtomSet, useAtomMount } from '@effect/atom-react';
import { useId } from 'react';
import {
  EnvironmentCommands,
  revalidateRemoteStatus,
} from '@porcelain/client/access';
import {
  clientRuntime,
  interruptCommandOnUnmount,
} from '../../../shared/application/store';
import { accessPlatform } from '../../../shared/adapters/access-platform';
import { REQUEST_TIMEOUT_MS } from '../../../config/limits';

const pairEnvironment = Atom.family((_identity: string) =>
  clientRuntime.fn(
    ({ value, onPaired }: { value: string; onPaired: () => void }) =>
      Effect.gen(function* () {
        const commands = yield* EnvironmentCommands;
        const remote = yield* commands
          .pair({ value })
          .pipe(Effect.timeout(REQUEST_TIMEOUT_MS));
        revalidateRemoteStatus(accessPlatform, remote);
        onPaired();
      }),
  ),
);
const readEnvironments = clientRuntime.fn((_: void) =>
  Effect.gen(function* () {
    const commands = yield* EnvironmentCommands;
    yield* commands.read();
  }),
);

export function usePairEnvironment(onPaired: () => void) {
  const identity = useId();
  const [result, run] = useAtom(pairEnvironment(identity));
  useAtomMount(interruptCommandOnUnmount(pairEnvironment(identity)));

  return {
    result,
    submit: (value: string) => run({ value, onPaired }),
    reset: () => run(Atom.Reset),
  };
}

export function useReadEnvironments() {
  return useAtomSet(readEnvironments);
}
