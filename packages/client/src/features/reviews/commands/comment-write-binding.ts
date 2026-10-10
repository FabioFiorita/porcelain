import { Exit } from 'effect';
export function commentWriteBinding<Input, A, E, Result>([
  result,
  submit,
]: readonly [Result, (input: Input) => Promise<Exit.Exit<A, E>>]) {
  return {
    result,
    send: (input: Input, onConfirmed?: () => void) => {
      void submit(input).then((exit) => {
        if (Exit.isSuccess(exit)) onConfirmed?.();
      });
    },
  };
}
