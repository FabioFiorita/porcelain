import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtom, useAtomMount } from '@effect/atom-react';
import { useId } from 'react';
import {
  clientRuntime,
  interruptCommandOnUnmount,
} from '../../../shared/application/store';
import { requestDevelopmentPairingLink } from '../api';

const developmentPairing = Atom.family((_identity: string) =>
  clientRuntime.fn(({ onLink }: { onLink: (link: string) => void }) =>
    Effect.gen(function* () {
      const link = yield* requestDevelopmentPairingLink();
      onLink(link);
    }),
  ),
);

export function useDevelopmentPairing() {
  const identity = useId();
  const [result, run] = useAtom(developmentPairing(identity));
  useAtomMount(interruptCommandOnUnmount(developmentPairing(identity)));

  return {
    result,
    request: (onLink: (link: string) => void) => run({ onLink }),
    reset: () => run(Atom.Reset),
  };
}
