import { Effect, Exit } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { useEffect, useRef, useState } from 'react';
import { EnvironmentCommands } from '@porcelain/client/access';
import { clientRuntime } from '../../../shared/application/store';

const pairEnvironment = Atom.family((_identity: symbol) =>
  clientRuntime.fn(
    ({
      value,
      signal,
    }: {
      readonly value: string;
      readonly signal: AbortSignal;
    }) =>
      Effect.gen(function* () {
        const commands = yield* EnvironmentCommands;
        return yield* commands.pair({ value, signal });
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
  const controller = useRef<AbortController | null>(null);
  const [result, run] = useAtom(pairEnvironment(identity), {
    mode: 'promiseExit',
  });
  useEffect(() => () => controller.current?.abort(), []);
  return {
    result,
    submit: (value: string) => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      void run({ value, signal: request.signal }).then((exit) => {
        if (Exit.isSuccess(exit) && !request.signal.aborted) onPaired();
      });
    },
  };
}

export function useReadEnvironments() {
  return useAtomSet(readEnvironments);
}
