import { ProjectsApi } from '@porcelain/contracts/projects';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { perConnection } from '../../shared/api/per-connection.ts';
import { transportClient } from '../../shared/api/effect-client.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createProjectsApi(transport: Transport) {
  return Effect.runSync(
    HttpApiClient.makeWith(ProjectsApi, {
      httpClient: transportClient(transport),
    }),
  ).projects;
}

export const projectsApi = perConnection(createProjectsApi);
