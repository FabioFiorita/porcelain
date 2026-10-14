import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom } from '@effect/atom-react';
import { useEffect, useState } from 'react';
import { clientRuntime } from '../../../shared/application/store';
import { requestDevelopmentPairingLink } from '../api';

const developmentPairing = Atom.family((_identity: symbol) =>
  clientRuntime.fn(({ onLink }: { onLink: (link: string) => void }) =>
    Effect.gen(function* () {
      const link = yield* requestDevelopmentPairingLink();
      onLink(link);
    }),
  ),
);

export function useDevelopmentPairing() {
  const [identity] = useState(Symbol);
  const [result, run] = useAtom(developmentPairing(identity));
  useEffect(
    () => () => {
      run(Atom.Interrupt);
    },
    [run],
  );
  return {
    result,
    request: (onLink: (link: string) => void) => run({ onLink }),
    reset: () => run(Atom.Reset),
  };
}
