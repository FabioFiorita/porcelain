import type { ListFilePreferencesResponse } from '@porcelain/contracts/projects';
import { Context, Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  confirmedResource,
  type ConfirmedResource,
} from '../../../shared/api/confirmed-resource.ts';
import {
  porcelainClient,
  type PorcelainApi,
} from '../../../shared/api/client.ts';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type FilePreferencesFailure =
  | Effect.Error<ReturnType<PorcelainApi['projects']['listFilePreferences']>>
  | RequestError;

export class FilePreferencesState extends Context.Service<
  FilePreferencesState,
  ConfirmedResource<ListFilePreferencesResponse, FilePreferencesFailure>
>()('@porcelain/client/FilePreferencesState') {
  static layer(connection: RuntimeConnection, projectId: string) {
    return Layer.effect(
      FilePreferencesState,
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        return yield* confirmedResource(
          connection,
          queryKeys.filePreferences(connection.environmentId, projectId),
          client.request((api) =>
            api.projects.listFilePreferences({ params: { projectId } }),
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
