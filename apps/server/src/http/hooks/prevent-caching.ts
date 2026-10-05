import { Effect } from 'effect';
import { HttpServerResponse } from 'effect/http';

export const preventCaching = <
  A extends HttpServerResponse.HttpServerResponse,
  E,
  R,
>(
  app: Effect.Effect<A, E, R>,
) =>
  app.pipe(
    Effect.map(HttpServerResponse.setHeader('Cache-Control', 'no-store')),
  );
