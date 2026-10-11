import { Exit } from 'effect';
import { Atom } from 'effect/reactivity';
export function commentWriteBinding<Input, A, E, Result>([
  result,
  submit,
]: readonly [Result, (input: Input | Atom.Reset) => Promise<Exit.Exit<A, E>>]) {
  return {
    result,
    send: (input: Input, onConfirmed?: () => void) => {
      void submit(input).then((exit) => {
        if (Exit.isSuccess(exit)) onConfirmed?.();
      });
    },
    reset: () => {
      void submit(Atom.Reset);
    },
  };
}
