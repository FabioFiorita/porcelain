import { PorcelainClientApi } from '@porcelain/contracts/shared';
import { Layer } from 'effect';
import { Atom, AtomHttpApi } from 'effect/reactivity';
import { HttpClient } from 'effect/http';
import type { WorktreeConnection } from './connection.ts';
import { transportClient, requestEffect } from './effect-client.ts';

export const porcelainClient = Atom.family((connection: WorktreeConnection) => {
  class Client extends AtomHttpApi.Service<Client>()(
    '@porcelain/client/HttpClient',
    {
      api: PorcelainClientApi,
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
