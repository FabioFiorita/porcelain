import { Cause, Exit } from 'effect';
import { AsyncResult } from 'effect/reactivity';

export function walkthroughCommandBinding<I, A, E>([result, send]: readonly [
  AsyncResult.AsyncResult<A, E>,
  (input: I) => Promise<Exit.Exit<A, E>>,
]) {
  return {
    waiting: AsyncResult.isWaiting(result),
    run: async (input: I) => {
      const exit = await send(input);
      if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
      return exit.value;
    },
  };
}
