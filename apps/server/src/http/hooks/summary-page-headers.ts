import { Effect } from 'effect';
import { HttpServerResponse } from 'effect/http';

export const summaryPageHeaders = <
  A extends HttpServerResponse.HttpServerResponse,
  E,
  R,
>(
  app: Effect.Effect<A, E, R>,
) =>
  app.pipe(
    Effect.map(
      HttpServerResponse.setHeaders({
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy':
          'sandbox allow-scripts allow-forms allow-popups allow-modals',
        'Referrer-Policy': 'no-referrer',
      }),
    ),
  );
