import { PorcelainClientApi } from '@porcelain/contracts/shared';
import { Layer } from 'effect';
import { Atom, AtomHttpApi } from 'effect/reactivity';
import { HttpClient } from 'effect/http';
import type { RuntimeConnection } from './connection.ts';
import { transportClient, requestEffect } from './effect-client.ts';

export const porcelainClient = Atom.family((connection: RuntimeConnection) => {
  class Client extends AtomHttpApi.Service<Client>()(
    '@porcelain/client/HttpClient',
    {
      api: PorcelainClientApi,
      runtime: connection.atoms,
      httpClient: Layer.succeed(
        HttpClient.HttpClient,
        transportClient(connection.transport),
      ),
      transformResponse: (response) =>
        requestEffect(response, connection.request().signal),
    },
  ) {}
  return Client;
});
