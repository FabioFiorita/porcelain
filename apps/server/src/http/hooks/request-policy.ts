import { Effect } from 'effect';
import type { HttpServerResponse } from 'effect/http';
import { HttpRouter } from 'effect/http';

export function requestPolicy<E, R>(
  before: Effect.Effect<void, E, R>,
  after: (
    response: HttpServerResponse.HttpServerResponse,
  ) => Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    R
  > = Effect.succeed,
) {
  return HttpRouter.middleware((app) =>
    Effect.gen(function* () {
      yield* before;
      return yield* after(yield* app);
    }),
  );
}
