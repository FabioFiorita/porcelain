import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { useEffect, useState } from 'react';
import {
  EnvironmentCommands,
  readRemoteStatus,
} from '@porcelain/client/access';
import { clientRuntime } from '../../../shared/application/store';
import { accessPlatform } from '../../../shared/adapters/access-platform';
import { REQUEST_TIMEOUT_MS } from '../../../config/limits';

const pairEnvironment = Atom.family((_identity: symbol) =>
  clientRuntime.fn(
    ({ value, onPaired }: { value: string; onPaired: () => void }, get) =>
      Effect.gen(function* () {
        const commands = yield* EnvironmentCommands;
        const remote = yield* commands
          .pair({ value })
          .pipe(Effect.timeout(REQUEST_TIMEOUT_MS));
        get.registry.refresh(readRemoteStatus(accessPlatform, remote));
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
  const [identity] = useState(Symbol);
  const [result, run] = useAtom(pairEnvironment(identity));
  useEffect(
    () => () => {
      run(Atom.Interrupt);
    },
    [run],
  );
  return {
    result,
    submit: (value: string) => run({ value, onPaired }),
    reset: () => run(Atom.Reset),
  };
}

export function useReadEnvironments() {
  return useAtomSet(readEnvironments);
}
