import { PorcelainClientApi } from '@porcelain/contracts/shared';
import { Context, Effect, Layer } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { Atom } from 'effect/reactivity';
import type { ConnectionError } from './connection-error.ts';
import type { RuntimeConnection } from './connection.ts';
import { requestEffect, transportLayer } from './effect-client.ts';
import type { RequestError } from './request-error.ts';

export type PorcelainApi = HttpApiClient.ForApi<typeof PorcelainClientApi>;

export type PorcelainRequest = <A, E, R>(
  use: (api: PorcelainApi) => Effect.Effect<A, E, R>,
  caller?: AbortSignal,
) => Effect.Effect<A, E | ConnectionError | RequestError, R>;

export const porcelainClient = Atom.family((connection: RuntimeConnection) => {
  class Client extends Context.Service<
    Client,
    { readonly request: PorcelainRequest }
  >()('@porcelain/client/HttpClient') {
    static readonly runtime = connection.atoms(
      Layer.effect(
        Client,
        Effect.map(HttpApiClient.make(PorcelainClientApi), (api) => ({
          request: (use, caller) =>
            requestEffect(use(api), () => connection.request(caller)),
        })),
      ).pipe(Layer.provide(transportLayer(connection.transport))),
    );
  }
  return Client;
});
