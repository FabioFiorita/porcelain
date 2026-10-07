import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { useEffect, useState } from 'react';
import { EnvironmentCommands } from '@porcelain/client/access';
import { clientRuntime } from '../../../shared/application/store';

const pairEnvironment = Atom.family((_identity: symbol) =>
  clientRuntime.fn(
    ({ value, onPaired }: { value: string; onPaired: () => void }) =>
      Effect.gen(function* () {
        const commands = yield* EnvironmentCommands;
        yield* commands.pair({ value });
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
  };
}

export function useReadEnvironments() {
  return useAtomSet(readEnvironments);
}
