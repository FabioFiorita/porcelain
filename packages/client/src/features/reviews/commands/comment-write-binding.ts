import { Exit, type Cause } from 'effect';
import { Atom } from 'effect/reactivity';
export function commentWriteBinding<Input, A, E, Result>([
  result,
  submit,
]: readonly [Result, (input: Input | Atom.Reset) => Promise<Exit.Exit<A, E>>]) {
  return {
    result,
    send: (
      input: Input,
      onConfirmed?: (answer: A) => void,
      onFailure?: (cause: Cause.Cause<E>) => void,
    ) => {
      void submit(input).then((exit) => {
        if (Exit.isSuccess(exit)) onConfirmed?.(exit.value);
        else onFailure?.(exit.cause);
      });
    },
    reset: () => {
      void submit(Atom.Reset);
    },
  };
}
