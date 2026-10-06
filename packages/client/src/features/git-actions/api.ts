import { GitActionsApi } from '@porcelain/contracts/git-actions';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { transportClient } from '../../shared/api/effect-client.ts';
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
