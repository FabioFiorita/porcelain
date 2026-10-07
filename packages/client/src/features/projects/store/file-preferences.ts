import type { ListFilePreferencesResponse } from '@porcelain/contracts/projects';
import { Context, Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  confirmedResource,
  type ConfirmedResource,
} from '../../../shared/api/confirmed-resource.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type FilePreferencesFailure =
  | Effect.Error<
      ReturnType<
        Context.Service.Shape<
          ReturnType<typeof porcelainClient>
        >['projects']['listFilePreferences']
      >
    >
  | RequestError;

export class FilePreferencesState extends Context.Service<
  FilePreferencesState,
  ConfirmedResource<ListFilePreferencesResponse, FilePreferencesFailure>
>()('@porcelain/client/FilePreferencesState') {
  static layer(connection: RuntimeConnection, projectId: string) {
    return Layer.effect(
      FilePreferencesState,
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        return yield* confirmedResource(
          connection,
          queryKeys.filePreferences(connection.environmentId, projectId),
          requestEffect(
            api.projects.listFilePreferences({ params: { projectId } }),
            connection.request,
          ),
        );
      }),
    );
  }
}

export const filePreferencesRuntime = Atom.family(
  ({
    connection,
    projectId,
  }: {
    connection: RuntimeConnection;
    projectId: string;
  }) =>
    connection.atoms((get) =>
      Layer.provideMerge(
        FilePreferencesState.layer(connection, projectId),
        get(clientRuntime(connection).layer),
      ),
    ),
);
