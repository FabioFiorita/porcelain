import { Effect, Exit } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { useEffect, useRef, useState } from 'react';
import { EnvironmentCommands } from '@porcelain/client/access';
import { clientRuntime } from '../../../shared/application/store';

const pairEnvironment = Atom.family((_identity: symbol) =>
  clientRuntime.fn((value: string) =>
    Effect.gen(function* () {
      const commands = yield* EnvironmentCommands;
      return yield* commands.pair({ value });
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
  const current = useRef(0);
  const [result, run] = useAtom(pairEnvironment(identity), {
    mode: 'promiseExit',
  });
  useEffect(
    () => () => {
      current.current += 1;
      void run(Atom.Interrupt);
    },
    [run],
  );
  return {
    result,
    submit: (value: string) => {
      const request = ++current.current;
      void run(value).then((exit) => {
        if (Exit.isSuccess(exit) && current.current === request) onPaired();
      });
    },
  };
}

export function useReadEnvironments() {
  return useAtomSet(readEnvironments);
}
