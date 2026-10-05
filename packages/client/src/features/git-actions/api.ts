import { GitActionsApi } from '@porcelain/contracts/git-actions';
import { Effect, Layer } from 'effect';
import { Atom, AtomHttpApi } from 'effect/reactivity';
import { HttpClient } from 'effect/http';
import type { WorktreeConnection } from '../../shared/api/connection.ts';
import { HttpApiClient } from 'effect/http-api';
import {
  transportClient,
  requestEffect,
} from '../../shared/api/effect-client.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createGitActionsApi(transport: Transport) {
  return Effect.runSync(
    HttpApiClient.makeWith(GitActionsApi, {
      httpClient: transportClient(transport),
    }),
  ).gitActions;
}

export const gitActionsApi = perConnection(createGitActionsApi);

export const gitActionsClient = Atom.family(
  (connection: WorktreeConnection) => {
    class Client extends AtomHttpApi.Service<Client>()(
      '@porcelain/client/GitActionsClient',
      {
        api: GitActionsApi,
        httpClient: Layer.succeed(
          HttpClient.HttpClient,
          transportClient(connection.transport),
        ),
        transformResponse: (response) =>
          requestEffect(response, connection.request().signal),
      },
    ) {}
    return Client;
  },
);
